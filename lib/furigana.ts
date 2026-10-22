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
