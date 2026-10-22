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
