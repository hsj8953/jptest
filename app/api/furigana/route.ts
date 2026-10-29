// AI(Gemini)로 가사 문장에 한자 읽기를 붙여요. (관리자 전용)
// GEMINI_API_KEY 는 서버에만 있어요 (Netlify 환경 변수 / .env.local, NEXT_PUBLIC_ 아님)

import { NextResponse } from 'next/server'
import { baseText } from '@/lib/ruby'
import { requireAdmin } from '@/lib/server-auth'
import { FAST_MODELS, callGemini } from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 26

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

const SCHEMA = {
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
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const body = (await req.json().catch(() => null)) as { lines?: unknown } | null
  const lines = Array.isArray(body?.lines) ? body.lines.filter((l): l is string => typeof l === 'string').map((l) => baseText(l)) : []
  if (!lines.length || lines.length > 120) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  // 빠른 모델 먼저 시도하고, 안 되면 다른 모델로 넘어가요
  const r = await callGemini(PROMPT, JSON.stringify({ lines }), SCHEMA, 24000, FAST_MODELS)
  if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: r.status })
  const parsed = r.json as { lines?: AiLine[] }

  // 원문 글자가 바뀐 줄은 버려요 (null)
  const out = lines.map((src, i) => {
    const a = parsed.lines?.[i]
    if (!a || typeof a.ruby !== 'string' || baseText(a.ruby) !== src) return null
    const unsure = Array.isArray(a.unsure) ? a.unsure.filter((u) => typeof u === 'string' && src.includes(u)) : []
    return { ruby: a.ruby, unsure }
  })
  return NextResponse.json({ lines: out })
}
