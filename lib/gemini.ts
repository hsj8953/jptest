// 서버에서 Gemini를 부르는 공통 코드: 모델이 없거나 바쁘면 다른 모델로 넘어가고, 시간 제한을 지켜요.
const DEFAULT_MODELS = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']
const uniq = (list: (string | undefined)[]) => list.filter((m, i, a): m is string => !!m && a.indexOf(m) === i)

/** 빠른 모델 먼저 (단어 뜻처럼 쉬운 작업용) */
export const FAST_MODELS = uniq(['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', ...DEFAULT_MODELS])

export type GeminiResult = { ok: true; json: unknown } | { ok: false; error: string; detail: string; status: number }

export async function callGemini(system: string, user: string, schema: object, budgetMs = 24000, models: string[] = uniq(DEFAULT_MODELS)): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return { ok: false, error: 'no_key', detail: '', status: 503 }
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema },
  })
  const started = Date.now()
  const busy = (s: number) => s === 500 || s === 502 || s === 503
  let last: Response | null = null
  let detail = ''
  outer: for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = budgetMs - (Date.now() - started)
      if (left < 3000) break outer
      try {
        last = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: payload,
          signal: AbortSignal.timeout(left),
        })
      } catch (e) {
        const timeout = (e as Error).name === 'TimeoutError'
        return { ok: false, error: timeout ? 'timeout' : 'ai_failed', detail: timeout ? 'AI 응답 시간 초과' : String((e as Error).message).slice(0, 200), status: 504 }
      }
      if (last.ok) break outer
      const errText = await last.text().catch(() => '')
      let msg = errText
      try {
        msg = (JSON.parse(errText) as { error?: { message?: string } }).error?.message ?? errText
      } catch {
        /* 그대로 */
      }
      detail = `${model}: ${last.status} ${msg}`.slice(0, 300)
      if (busy(last.status)) {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800))
        continue
      }
      if (last.status === 404 || (last.status === 400 && /model/i.test(msg))) continue outer
      break outer
    }
  }
  if (!last || !last.ok) {
    const s = last?.status ?? 504
    const error = s === 429 ? 'rate_limited' : busy(s) ? 'busy' : s === 403 || (s === 400 && /api key/i.test(detail)) ? 'bad_key' : last ? 'ai_failed' : 'timeout'
    return { ok: false, error, detail: detail || 'AI 응답 시간 초과', status: s === 429 ? 429 : busy(s) ? 503 : 502 }
  }
  const data = (await last.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  try {
    return { ok: true, json: JSON.parse(text) }
  } catch {
    return { ok: false, error: 'ai_failed', detail: 'AI 응답을 읽지 못했어요', status: 502 }
  }
}
