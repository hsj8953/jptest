// 후리가나 표기법: 漢字{かんじ} — 중괄호 바로 앞의 한자 덩어리에 읽기가 붙어요.
export const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/

/** 읽기 표기를 뺀 원래 문장 (채점 기준) */
export function baseText(s: string) {
  return String(s ?? '').replace(/\{[^{}]*\}/g, '')
}

export type RubyPart = { text: string; reading?: string }

export function parseRuby(s: string): RubyPart[] {
  const out: RubyPart[] = []
  let buf = ''
  for (const p of String(s ?? '').split(/(\{[^{}]*\})/)) {
    if (p.startsWith('{') && p.endsWith('}')) {
      const chars = Array.from(buf)
      let k = chars.length
      while (k > 0 && KANJI.test(chars[k - 1])) k--
      const head = chars.slice(0, k).join('')
      const kan = chars.slice(k).join('')
      if (head) out.push({ text: head })
      if (kan) out.push({ text: kan, reading: p.slice(1, -1) })
      buf = ''
    } else buf += p
  }
  if (buf) out.push({ text: buf })
  return out
}

export type Segment = { text: string; reading?: string; kanji: boolean }

/** 문장을 한자 덩어리 / 그 외 덩어리로 나눠요. 한자 덩어리에는 읽기가 붙어 있을 수 있어요. */
export function splitRuby(s: string): Segment[] {
  const out: Segment[] = []
  for (const p of parseRuby(s)) {
    if (p.reading) {
      out.push({ text: p.text, reading: p.reading, kanji: true })
      continue
    }
    const runs = p.text.match(/[㐀-䶿一-鿿豈-﫿々〆ヶ]+|[^㐀-䶿一-鿿豈-﫿々〆ヶ]+/g) ?? []
    for (const r of runs) out.push({ text: r, kanji: KANJI.test(r) })
  }
  return out
}

/** splitRuby 결과를 다시 漢字{かんじ} 표기로 합쳐요 */
export function joinRuby(segs: Segment[]) {
  return segs.map((g) => (g.kanji && g.reading ? `${g.text}{${g.reading}}` : g.text)).join('')
}

// 겉모양은 일반 한자와 똑같지만 번호가 다른 글자들
//   ⺀-⻿ 부수 보충, ⼀-⿟ 강희 부수(예: ⼈ ⾔ ⽼), 豈-﫿 호환 한자, 丽-𯨟 호환 한자 보충
// 가사 사이트나 PDF에서 복사할 때 섞여 들어오는 경우가 있어서, 일반 한자로 바꿔요.
const LOOKALIKE = /[⺀-⻿⼀-⿟豈-﫿]|[\uD87E][\uDC00-\uDE1F]/g

/** 부수·호환 한자를 일반 한자로 바꿔요. 다른 글자(가나, 기호, 띄어쓰기)는 그대로예요. */
export function normalizeKanji(s: string) {
  return String(s ?? '').replace(LOOKALIKE, (c) => c.normalize('NFKC'))
}

/** 전각 숫자·알파벳(１２３ ＡＢＣ ａｂｃ)을 반각(123 ABC abc)으로 바꿔요. 가나·기호·띄어쓰기는 그대로예요. */
export function normalizeWidth(s: string) {
  return String(s ?? '').replace(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

/** 채점할 때 쓰는 정리: 부수·호환 한자 → 일반 한자, 전각 숫자·알파벳 → 반각, 앞뒤 공백 제거 */
export function normalizeAnswer(s: string) {
  return normalizeWidth(normalizeKanji(s)).trim()
}

/** 띄어쓰기(반각·전각 공백)를 모두 뺀 문장 — 채점은 띄어쓰기를 무시해요 */
export const stripSpaces = (s: string) => s.replace(/[\s\u3000]+/g, '')

/** 받아쓰기 채점: 띄어쓰기는 무시하고 나머지는 한 글자도 틀리면 안 돼요 */
export function sameAnswer(input: string, answer: string) {
  return stripSpaces(normalizeAnswer(input)) === stripSpaces(normalizeAnswer(answer))
}

/** 채점용 정답 문장 (읽기 표기 제거 + 정리) */
export function answerOf(ruby: string) {
  return normalizeAnswer(baseText(ruby))
}

/**
 * 문장 풀이의 단어들(w)에 가사 후리가나로 읽기를 붙여요.
 * 가사에 적힌 후리가나(노래에서 부르는 읽기)를 그대로 쓰고, 가나는 그대로 읽어요.
 * 단어가 한자 덩어리의 일부만 걸치거나 읽기가 없는 한자가 있으면 null (→ AI가 준 읽기를 써요).
 */
export function readingsFromRuby(ruby: string, words: string[]): (string | null)[] {
  // 글자 하나하나에 읽기 조각을 붙여 둬요: 한자 덩어리는 첫 글자에 덩어리 전체 읽기, 나머지 글자는 '' (덩어리 안)
  const chars: { ch: string; read: string | null; head: boolean; inBlock: boolean }[] = []
  for (const seg of splitRuby(normalizeKanji(ruby))) {
    const cs = Array.from(seg.text)
    if (seg.kanji) cs.forEach((ch, i) => chars.push({ ch, read: i === 0 ? (seg.reading ?? null) : '', head: i === 0, inBlock: true }))
    else cs.forEach((ch) => chars.push({ ch, read: /[㐀-鿿々〆]/.test(ch) ? null : ch, head: true, inBlock: false }))
  }
  const plain = chars.map((c) => c.ch)
  let pos = 0
  return words.map((w) => {
    const target = Array.from(normalizeKanji(w).replace(/\s+/g, ''))
    if (!target.length) return null
    // 앞에서부터 이어서 찾아요 (공백은 건너뛰어요)
    let start = -1
    for (let i = pos; i <= plain.length - target.length; i++) {
      if (target.every((ch, k) => plain[i + k] === ch)) {
        start = i
        break
      }
    }
    if (start < 0) return null
    const end = start + target.length
    pos = end
    const span = chars.slice(start, end)
    // 한자 덩어리 가운데서 시작하거나, 덩어리 중간에서 끝나면 정확한 읽기를 모르니 포기
    if (!span[0].head) return null
    if (end < chars.length && chars[end].inBlock && !chars[end].head) return null
    if (span.some((c) => c.read === null)) return null
    return span.map((c) => c.read).join('')
  })
}

/** 단어와 그 읽기를 한자 부분에만 후리가나가 붙는 표기로 바꿔요. 예) 抱きしめて + だきしめて → 抱{だ}きしめて
 *  가나 부분을 기준으로 읽기를 나눠요. 맞출 수 없으면 단어 전체에 읽기를 붙여요. */
export function rubyOf(text: string, reading: string) {
  if (!reading || !KANJI.test(text)) return text
  const kata2hira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  const runs = text.match(/[㐀-䶿一-鿿豈-﫿々〆ヶ]+|[^㐀-䶿一-鿿豈-﫿々〆ヶ]+/g) ?? [text]
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp('^' + runs.map((r) => (KANJI.test(r) ? '(.+?)' : esc(kata2hira(r)))).join('') + '$')
  const m = kata2hira(reading).match(re)
  if (!m) return `${text}{${reading}}`
  let g = 1
  return runs.map((r) => (KANJI.test(r) ? `${r}{${m[g++]}}` : r)).join('')
}
