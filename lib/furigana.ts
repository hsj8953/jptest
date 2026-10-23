import type { IpadicFeatures, Tokenizer } from 'kuromoji'
import { KANJI, baseText } from './ruby'

type KuromojiGlobal = {
  builder: (o: { dicPath: string }) => { build: (cb: (err: Error | null, t: Tokenizer<IpadicFeatures>) => void) => void }
}
declare global {
  interface Window {
    kuromoji?: KuromojiGlobal
  }
}

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null

// /public/kuromoji 에 복사된 브라우저용 kuromoji 를 필요할 때만 불러와요 (사전 약 18MB, 첫 사용 때 한 번).
function loadScript(): Promise<KuromojiGlobal> {
  return new Promise((resolve, reject) => {
    if (window.kuromoji) return resolve(window.kuromoji)
    const s = document.createElement('script')
    s.src = '/kuromoji/kuromoji.js'
    s.onload = () => (window.kuromoji ? resolve(window.kuromoji) : reject(new Error('kuromoji 없음')))
    s.onerror = () => reject(new Error('kuromoji를 불러오지 못했어요'))
    document.head.append(s)
  })
}

export function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = loadScript().then(
      (k) =>
        new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) => {
          k.builder({ dicPath: '/kuromoji/dict/' }).build((err, t) => (err ? reject(err) : resolve(t)))
        }),
    )
    tokenizerPromise.catch(() => {
      tokenizerPromise = null
    })
  }
  return tokenizerPromise
}

const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const RUN = /[㐀-䶿一-鿿豈-﫿々〆ヶ]+|[^㐀-䶿一-鿿豈-﫿々〆ヶ]+/g

// 단어 하나: 食べる + タベル → 食{た}べる
function annotate(surface: string, reading?: string) {
  if (!KANJI.test(surface) || !reading || reading === '*') return surface
  const r = toHira(reading)
  const segs = surface.match(RUN) ?? [surface]
  const re = new RegExp('^' + segs.map((g) => (KANJI.test(g) ? '(.+?)' : escRe(toHira(g)))).join('') + '$')
  const m = r.match(re)
  if (m) {
    let k = 1
    return segs.map((g) => (KANJI.test(g) ? `${g}{${m[k++]}}` : g)).join('')
  }
  return segs.length === 1 ? `${surface}{${r}}` : surface
}

/** 문장 → 후리가나 표기. 원문 글자는 절대 바꾸지 않아요. */
export async function addFurigana(line: string) {
  const base = baseText(line)
  if (!KANJI.test(base)) return base
  const t = await getTokenizer()
  const out = t
    .tokenize(base)
    .map((tk) => annotate(tk.surface_form, tk.reading))
    .join('')
  return baseText(out) === base ? out : base
}

import { getFirebaseAuth } from './firebase'
import { splitRuby } from './ruby'

export type FuriResult = { ruby: string; check: string[] }

/** 한자 덩어리 → 읽기 (등장 순서대로) */
function readingsOf(ruby: string) {
  return splitRuby(ruby).filter((g) => g.kanji).map((g) => ({ text: g.text, reading: g.reading ?? '' }))
}

/**
 * AI로 읽기를 만들고, 사전(kuromoji) 결과와 비교해서 서로 다르거나 AI가 확신 없는 단어를 표시해요.
 * AI를 못 쓰면 사전 결과만 돌려주고 aiUsed=false.
 */
export async function generateFurigana(lines: string[], onProgress?: (done: number, total: number) => void): Promise<{ results: FuriResult[]; aiUsed: boolean; aiError?: string }> {
  const dict: string[] = []
  for (const l of lines) dict.push(KANJI.test(baseText(l)) ? await addFurigana(l) : baseText(l))

  let ai: ({ ruby: string; unsure: string[] } | null)[] = lines.map(() => null)
  let aiUsed = false
  let aiError: string | undefined
  try {
    const token = await getFirebaseAuth().currentUser?.getIdToken()
    if (!token) throw new Error('unauthorized')
    const CHUNK = 60
    for (let i = 0; i < lines.length; i += CHUNK) {
      onProgress?.(i, lines.length)
      const res = await fetch('/api/furigana', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ lines: lines.slice(i, i + CHUNK).map(baseText) }),
      })
      const json = (await res.json().catch(() => ({}))) as { lines?: ({ ruby: string; unsure: string[] } | null)[]; error?: string }
      if (!res.ok || !json.lines) throw new Error(json.error ?? 'ai_failed')
      json.lines.forEach((r, j) => (ai[i + j] = r))
    }
    aiUsed = true
  } catch (e) {
    aiError = (e as Error).message
    ai = lines.map(() => null)
  }

  const results = lines.map((src, i) => {
    const d = dict[i]
    const a = ai[i]
    if (!KANJI.test(baseText(src))) return { ruby: baseText(src), check: [] }
    if (!a) return { ruby: d, check: aiUsed ? readingsOf(d).map((r) => r.text) : [] }
    const check = new Set(a.unsure)
    // 사전과 AI의 읽기가 다른 한자 덩어리는 확인 필요
    const ar = readingsOf(a.ruby)
    const dr = readingsOf(d)
    if (ar.length === dr.length) {
      ar.forEach((r, k) => {
        if (r.text === dr[k].text && r.reading !== dr[k].reading) check.add(r.text)
      })
    }
    ar.forEach((r) => {
      if (!r.reading) check.add(r.text)
    })
    return { ruby: a.ruby, check: [...check] }
  })
  onProgress?.(lines.length, lines.length)
  return { results, aiUsed, aiError }
}
