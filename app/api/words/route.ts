// 단어장: 한자 단어의 사전형 읽기와 한국어 뜻을 Gemini로 만들어요 (관리자 전용)
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-auth'
import { FAST_MODELS, callGemini } from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 26

const PROMPT = `You build a vocabulary list for a Korean learner studying Japanese through song lyrics.
For each item you get a Japanese word in dictionary form (it contains kanji) and one lyric line where it appears (context).
Return for each word:
- "reading": the hiragana reading of the dictionary form (e.g. 咲く → さく, 夜空 → よぞら). Use the reading that fits the context.
- "meaning": a short, natural Korean meaning like a dictionary entry, 1 to 4 words (e.g. 피다, 밤하늘, 기억하다). If the word has several meanings, give the one that fits the context first, separated by ", " (max 2).
Keep "word" exactly as given. Return JSON: {"words":[{"word": string, "reading": string, "meaning": string}]} in the same order.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    words: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { word: { type: 'STRING' }, reading: { type: 'STRING' }, meaning: { type: 'STRING' } },
        required: ['word', 'reading', 'meaning'],
      },
    },
  },
  required: ['words'],
}

const HIRA = /^[ぁ-ゟー]+$/

export async function POST(req: Request) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const body = (await req.json().catch(() => null)) as { items?: unknown } | null
  const items = Array.isArray(body?.items)
    ? body.items
        .filter((x): x is { word: string; context: string } => !!x && typeof (x as { word?: unknown }).word === 'string')
        .map((x) => ({ word: x.word.slice(0, 30), context: String(x.context ?? '').slice(0, 120) }))
    : []
  if (!items.length || items.length > 60) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const r = await callGemini(PROMPT, JSON.stringify({ items }), SCHEMA, 24000, FAST_MODELS)
  if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: r.status })
  const out = (r.json as { words?: { word?: string; reading?: string; meaning?: string }[] }).words ?? []
  const byWord = new Map(out.filter((w) => typeof w.word === 'string').map((w) => [w.word as string, w]))
  return NextResponse.json({
    words: items.map((it, i) => {
      const w = byWord.get(it.word) ?? out[i]
      if (!w || w.word !== it.word) return null
      const reading = String(w.reading ?? '').trim()
      return { word: it.word, reading: HIRA.test(reading) ? reading : '', meaning: String(w.meaning ?? '').trim().slice(0, 40) }
    }),
  })
}
