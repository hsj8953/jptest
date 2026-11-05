// 문장 풀이: 가사 한 줄을 단어별 뜻·품사·문법 포인트·직역/의역으로 풀어요 (관리자 전용)
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-auth'
import { callGemini } from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 60

const PROMPT = `You explain Japanese song lyric lines to Korean learners (from beginners to intermediate).
For each item you get one Japanese line ("ja") and its official Korean translation ("ko", may be empty).
Return for each line:
- "words": split the line into words in order, covering the WHOLE line exactly (joining all "w" must give the original line without spaces/punctuation changes; keep punctuation and spaces as their own tokens only if they are meaningful, otherwise attach them to the previous word). Merge a verb/adjective with its inflection endings into one word (咲いた, 会いたくて, 忘れない). For each word:
  - "w": the surface form exactly as in the line
  - "r": hiragana reading of the surface form (empty string if it is only kana or not Japanese)
  - "pos": one Korean part of speech: 명사, 대명사, 동사, 형용사, 형용동사, 부사, 조사, 조동사, 접속사, 감탄사, 연체사, 접미사, 기타
  - "m": short Korean meaning as used in this line (1~5 words; for particles like "~에", "~을/를")
  - "note": optional very short Korean note for beginners about the form or role (e.g. "咲く(피다)의 과거형", "주어를 나타내요", "~하고 싶어 (희망)"). Empty string if nothing useful.
- "grammar": 1 or 2 grammar points worth learning in this line (fewer if the line is trivial). "title" is the Japanese pattern with a short Korean gloss (e.g. "～た 과거형 (~했다)"), "body" is 1~2 Korean sentences explaining the rule plus 2 short extra examples in the form "咲く → 咲いた". Write examples in Japanese; never quote other song lyrics.
- "literal": a word-for-word Korean literal translation.
- "natural": a natural Korean translation (you may follow "ko" if given).
Use polite, simple Korean (해요체) in notes and bodies. Return JSON {"lines":[...]} with exactly one entry per input item, in the same order.`

const WORD = {
  type: 'OBJECT',
  properties: { w: { type: 'STRING' }, r: { type: 'STRING' }, pos: { type: 'STRING' }, m: { type: 'STRING' }, note: { type: 'STRING' } },
  required: ['w', 'r', 'pos', 'm', 'note'],
}
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          words: { type: 'ARRAY', items: WORD },
          grammar: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, body: { type: 'STRING' } }, required: ['title', 'body'] } },
          literal: { type: 'STRING' },
          natural: { type: 'STRING' },
        },
        required: ['words', 'grammar', 'literal', 'natural'],
      },
    },
  },
  required: ['lines'],
}

const HIRA = /^[ぁ-ゟー]*$/
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const body = (await req.json().catch(() => null)) as { items?: unknown } | null
  const items = Array.isArray(body?.items)
    ? body.items
        .filter((x): x is { ja: string; ko?: string } => !!x && typeof (x as { ja?: unknown }).ja === 'string')
        .map((x) => ({ ja: x.ja.slice(0, 200), ko: String(x.ko ?? '').slice(0, 200) }))
    : []
  if (!items.length || items.length > 8) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const r = await callGemini(PROMPT, JSON.stringify({ items }), SCHEMA, 55000)
  if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: r.status })
  const out = (r.json as { lines?: unknown[] }).lines ?? []
  return NextResponse.json({
    lines: items.map((_, i) => {
      const l = out[i] as { words?: unknown[]; grammar?: unknown[]; literal?: unknown; natural?: unknown } | undefined
      if (!l || !Array.isArray(l.words) || !l.words.length) return null
      return {
        words: l.words.slice(0, 40).map((x) => {
          const w = x as Record<string, unknown>
          const reading = str(w.r, 40)
          return { w: str(w.w, 40), r: HIRA.test(reading) ? reading : '', pos: str(w.pos, 10), m: str(w.m, 60), note: str(w.note, 80) }
        }).filter((w) => w.w),
        grammar: (Array.isArray(l.grammar) ? l.grammar : []).slice(0, 2).map((x) => {
          const g = x as Record<string, unknown>
          return { title: str(g.title, 60), body: str(g.body, 300) }
        }).filter((g) => g.title),
        literal: str(l.literal, 200),
        natural: str(l.natural, 200),
      }
    }),
  })
}
