// 서버에서 Gemini를 부르는 공통 코드: 모델이 없거나 바쁘면 다른 모델로 넘어가고, 시간 제한을 지켜요.
const DEFAULT_MODELS = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']
const uniq = (list: (string | undefined)[]) => list.filter((m, i, a): m is string => !!m && a.indexOf(m) === i)

/** 빠른 모델 먼저 (단어 뜻처럼 쉬운 작업용) */
export const FAST_MODELS = uniq(['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', ...DEFAULT_MODELS])

export type GeminiResult = { ok: true; json: unknown } | { ok: false; error: string; detail: string; status: number }

// 모델이 답하기 전에 오래 "생각"하지 않게 해서 빠르게 답하게 해요.
// 이 설정을 모르는 모델이면 400이 나오는데, 그때는 설정을 빼고 다시 보내요.
const noThinking = new Set<string>()
function payloadFor(model: string, system: string, user: string, schema: object) {
  const generationConfig: Record<string, unknown> = { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema }
  if (!noThinking.has(model)) {
    generationConfig.thinkingConfig = /2\.5/.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: 'low' }
  }
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig,
  })
}

/**
 * 무료 사용량에 맞춘 호출 순서
 * - 바쁨(503)·한도 초과(429): 같은 모델을 붙잡지 않고 바로 다음 모델로 (모델마다 한도가 따로예요)
 * - 모델이 없음(404): 다음 모델로
 * - 전체 시간은 budgetMs 안에서 끝내요 (Netlify 서버 제한 약 26초)
 */
export async function callGemini(system: string, user: string, schema: object, budgetMs = 24000, models: string[] = uniq(DEFAULT_MODELS)): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return { ok: false, error: 'no_key', detail: '', status: 503 }
  const started = Date.now()
  const busy = (s: number) => s === 500 || s === 502 || s === 503
  let last: Response | null = null
  let lastStatus = 0
  let detail = ''
  let sawRate = false
  let sawBusy = false

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = budgetMs - (Date.now() - started)
      if (left < 2500) break
      try {
        last = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: payloadFor(model, system, user, schema),
          signal: AbortSignal.timeout(left),
        })
      } catch (e) {
        const timeout = (e as Error).name === 'TimeoutError'
        return { ok: false, error: timeout ? 'timeout' : 'ai_failed', detail: timeout ? 'AI 응답 시간 초과' : String((e as Error).message).slice(0, 200), status: 504 }
      }
      lastStatus = last.status
      if (last.ok) {
        const data = (await last.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
        const text = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? ''
        try {
          return { ok: true, json: JSON.parse(text) }
        } catch {
          detail = `${model}: 응답을 읽지 못했어요`
          break // 다음 모델로
        }
      }
      const errText = await last.text().catch(() => '')
      let msg = errText
      try {
        msg = (JSON.parse(errText) as { error?: { message?: string } }).error?.message ?? errText
      } catch {
        /* 그대로 */
      }
      detail = `${model}: ${last.status} ${msg}`.slice(0, 300)
      // 생각 설정을 모르는 모델 → 설정 빼고 같은 모델로 한 번 더
      if (last.status === 400 && /thinking/i.test(msg) && !noThinking.has(model)) {
        noThinking.add(model)
        continue
      }
      if (last.status === 429) sawRate = true
      if (busy(last.status)) sawBusy = true
      break // 바쁨·한도·없음·기타 → 다음 모델로
    }
    // 키가 잘못된 경우는 다른 모델도 똑같으니 바로 멈춰요
    if (lastStatus === 403 || (lastStatus === 400 && /api key/i.test(detail))) break
    if (budgetMs - (Date.now() - started) < 2500) break
  }

  const s = lastStatus
  const error =
    s === 403 || (s === 400 && /api key/i.test(detail)) ? 'bad_key'
    : sawRate ? 'rate_limited'
    : sawBusy ? 'busy'
    : last ? 'ai_failed'
    : 'timeout'
  return { ok: false, error, detail: detail || 'AI 응답 시간 초과', status: error === 'rate_limited' ? 429 : error === 'busy' ? 503 : 502 }
}
