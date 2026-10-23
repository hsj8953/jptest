// AI(Gemini)로 가사 문장에 한자 읽기를 붙여요.
// - GEMINI_API_KEY 는 서버에만 있어요 (Netlify 환경 변수, NEXT_PUBLIC_ 아님)
// - 관리자만 쓸 수 있게 Firebase 로그인 토큰을 확인해요

import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import { baseText } from '@/lib/ruby'

export const runtime = 'nodejs'
export const maxDuration = 26

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()
// 앞에서부터 시도하고, 모델을 못 찾으면 다음 모델로 넘어가요
const MODELS = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'].filter((m, i, a): m is string => !!m && a.indexOf(m) === i)
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

type AiLine = { ruby?: string; unsure?: string[] }

const PROMPT = `You add furigana (hiragana readings) to Japanese song lyric lines for a Korean learner who will check them by ear.

Rules:
- For every run of consecutive kanji, write its hiragana reading in curly braces right after the run: 夜空{よぞら}に光{ひかり}が.
- Okurigana stays outside the braces: 歩{ある}く, 帰{かえ}り道{みち}.
- Read each line in context of the whole song. Prefer the reading a singer would most likely sing. Song lyrics sometimes use poetic or unusual readings; use them only when context makes them likely.
- Numbers and counters must match the context (一日 as ついたち or いちにち, etc.).
- Never change, add or remove any other character, space or punctuation. Lines without kanji are returned unchanged.
- In "unsure", list the kanji runs (exactly as written in the line) whose reading you are not confident about, e.g. words with several common readings or possible special lyric readings. Leave it empty when confident.

Return JSON: {"lines":[{"ruby": string, "unsure": string[]}]} with exactly the same number of lines, in the same order.`

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'no_key' }, { status: 503 })

  // 관리자 확인
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !PROJECT_ID) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID })
    const email = String(payload.email ?? '').toLowerCase()
    if (!payload.email_verified || !ADMIN_EMAIL || email !== ADMIN_EMAIL) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as { lines?: unknown } | null
  const lines = Array.isArray(body?.lines) ? body.lines.filter((l): l is string => typeof l === 'string').map((l) => baseText(l)) : []
  if (!lines.length || lines.length > 120) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ lines }) }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          lines: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { ruby: { type: 'STRING' }, unsure: { type: 'ARRAY', items: { type: 'STRING' } } },
              required: ['ruby', 'unsure'],
            },
          },
        },
        required: ['lines'],
      },
    },
  })

  let res: Response | null = null
  let detail = ''
  const started = Date.now()
  const busy = (status: number) => status === 503 || status === 500 || status === 502
  outer: for (const model of MODELS) {
    // 바쁠 때(503)는 같은 모델로 한 번 더 시도한 뒤 다음 모델로 넘어가요
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = 24000 - (Date.now() - started)
      if (left < 3000) break outer
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: payload,
          signal: AbortSignal.timeout(left),
        })
      } catch (e) {
        const timeout = (e as Error).name === 'TimeoutError'
        return NextResponse.json({ error: timeout ? 'timeout' : 'ai_failed', detail: timeout ? 'AI 응답 시간 초과' : String((e as Error).message).slice(0, 200) }, { status: 504 })
      }
      if (res.ok) break outer
      const errText = await res.text().catch(() => '')
      let msg = errText
      try {
        msg = (JSON.parse(errText) as { error?: { message?: string } }).error?.message ?? errText
      } catch {
        /* 텍스트 그대로 */
      }
      detail = `${model}: ${res.status} ${msg}`.slice(0, 300)
      if (busy(res.status)) {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800))
        continue
      }
      // 모델을 못 찾은 경우는 다음 모델로, 그 밖의 오류는 중단
      if (res.status === 404 || (res.status === 400 && /model/i.test(msg))) continue outer
      break outer
    }
  }
  if (!res || !res.ok) {
    const status = res?.status === 429 ? 429 : res && busy(res.status) ? 503 : res?.status === 400 || res?.status === 403 ? 400 : 502
    const error = res?.status === 429 ? 'rate_limited' : res && busy(res.status) ? 'busy' : res?.status === 400 && /api key/i.test(detail) ? 'bad_key' : res?.status === 403 ? 'bad_key' : 'ai_failed'
    return NextResponse.json({ error, detail }, { status })
  }

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  let parsed: { lines?: AiLine[] } = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'ai_failed', detail: 'AI 응답을 읽지 못했어요' }, { status: 502 })
  }

  // 원문 글자가 바뀐 줄은 버려요 (null)
  const out = lines.map((src, i) => {
    const a = parsed.lines?.[i]
    if (!a || typeof a.ruby !== 'string' || baseText(a.ruby) !== src) return null
    const unsure = Array.isArray(a.unsure) ? a.unsure.filter((u) => typeof u === 'string' && src.includes(u)) : []
    return { ruby: a.ruby, unsure }
  })
  return NextResponse.json({ lines: out })
}
