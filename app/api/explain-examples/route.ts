// 문장 풀이의 단어·문법마다 실생활 예문을 만들어요 (관리자 전용)
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-auth'
import { callGemini, FAST_MODELS } from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 130

const PROMPT = `You write short everyday Japanese example sentences for Korean learners (beginner to intermediate).
Each item has a Japanese song line ("line"), a list of words from it ("words": surface form + Korean meaning) and grammar points ("grammar").
For EVERY word and EVERY grammar point, write ONE example sentence used in daily life (conversation, school, work, shopping, weather, food…):
- It must use that word (any conjugated form is fine) or that grammar pattern, with the same meaning as in the line.
- Short and natural: about 6~20 Japanese characters. Polite or casual everyday speech. Never quote or paraphrase song lyrics.
- "ja": the sentence with furigana for EVERY kanji word written right after it in braces, like 毎日{まいにち}学校{がっこう}に行{い}きます。 Kana-only words get no braces.
- "ko": a natural Korean translation (해요체 or 반말, matching the Japanese).
Return JSON {"items":[{"words":[{"ja","ko"}...],"grammar":[{"ja","ko"}...]}...]} with exactly one entry per input item, and inside it exactly one example per input word and per grammar point, in the same order.`

const EX = { type: 'OBJECT', properties: { ja: { type: 'STRING' }, ko: { type: 'STRING' } }, required: ['ja', 'ko'] }
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { words: { type: 'ARRAY', items: EX }, grammar: { type: 'ARRAY', items: EX } }, required: ['words', 'grammar'] },
    },
  },
  required: ['items'],
}

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const HANGUL = /[\u3131-\u318E\uAC00-\uD7A3]/
const KANJI = /[\u3400-\u9FFF々]/
const ex = (x: unknown) => {
  const o = (x ?? {}) as Record<string, unknown>
  const ja = str(o.ja, 120)
  const ko = str(o.ko, 120)
  // 일본어 예문에 한글이 섞여 나오면(走るの손好き 같은 깨진 문장) 버려요
  return ja && ko && !HANGUL.test(ja) ? { ja, ko } : null
}
/** 예문이 정말 그 단어를 쓰는지 (会える 자리에 読める 예문이 오는 걸 걸러요). 활용형도 통과하게 느슨하게 봐요 */
function usesWord(ja: string, w: string) {
  const base = ja.replace(/\{[^{}]*\}/g, '')
  const kanji = Array.from(w).find((c) => KANJI.test(c))
  if (kanji) return base.includes(kanji)
  const chars = Array.from(w)
  if (chars.length <= 2) return true // 짧은 가나 단어는 활용하면 모양이 다 바뀌어서 확인하지 않아요
  return base.includes(chars.slice(0, -1).join(''))
}

type In = { line: string; words: { w: string; m: string }[]; grammar: string[] }

export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const body = (await req.json().catch(() => null)) as { items?: unknown } | null
  const items: In[] = Array.isArray(body?.items)
    ? body.items.map((x) => {
        const o = (x ?? {}) as Record<string, unknown>
        return {
          line: str(o.line, 200),
          words: (Array.isArray(o.words) ? o.words : []).slice(0, 40).map((w) => ({ w: str((w as Record<string, unknown>)?.w, 40), m: str((w as Record<string, unknown>)?.m, 60) })),
          grammar: (Array.isArray(o.grammar) ? o.grammar : []).slice(0, 3).map((g) => str(g, 80)),
        }
      })
    : []
  if (!items.length || items.length > 6) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  // 예문은 쉬운 작업이라 빠른 모델부터 써요
  const r = await callGemini(PROMPT, JSON.stringify({ items }), SCHEMA, 110000, FAST_MODELS)
  if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: r.status })
  const out = (r.json as { items?: unknown[] }).items ?? []
  return NextResponse.json({
    items: items.map((it, i) => {
      const o = (out[i] ?? {}) as { words?: unknown[]; grammar?: unknown[] }
      const w = Array.isArray(o.words) ? o.words : []
      const g = Array.isArray(o.grammar) ? o.grammar : []
      // 개수가 안 맞으면 순서가 어긋났을 수 있어서 그 문장은 버려요
      if (w.length !== it.words.length || g.length !== it.grammar.length) return null
      // 못 쓰는 예문은 null로 돌려줘요 (그 단어는 비워 두고, 다음에 '예문 채우기'를 누르면 다시 만들어요)
      return {
        words: w.map((x, k) => {
          const e = ex(x)
          return e && usesWord(e.ja, it.words[k].w) ? e : null
        }),
        grammar: g.map(ex),
      }
    }),
  })
}
