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

/** 채점용 정답 문장 (읽기 표기 제거 + 한자 정리 + 앞뒤 공백 제거) */
export function answerOf(ruby: string) {
  return normalizeKanji(baseText(ruby)).trim()
}
