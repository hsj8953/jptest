// AI(Gemini)로 가사 문장에 한자 읽기를 붙여요.
// - GEMINI_API_KEY 는 서버에만 있어요 (Netlify 환경 변수, NEXT_PUBLIC_ 아님)
// - 관리자만 쓸 수 있게 Firebase 로그인 토큰을 확인해요

import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import { baseText } from '@/lib/ruby'

export const runtime = 'nodejs'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'
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

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
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
    }),
  })
  if (!res.ok) {
    const status = res.status === 429 ? 429 : 502
    return NextResponse.json({ error: status === 429 ? 'rate_limited' : 'ai_failed' }, { status })
  }

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  let parsed: { lines?: AiLine[] } = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'ai_failed' }, { status: 502 })
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
