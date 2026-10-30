// 가사 사이트에서 후리가나째 복사한 가사를 漢字{かんじ} 표기로 바꿔요.
// - <ruby>漢字<rt>かんじ</rt></ruby> (대부분의 사이트)
// - <span class="rb">漢字</span><span class="rt">かんじ</span> (UtaTen 같은 사이트)
// - 漢字(かんじ) / 漢字（かんじ） 처럼 괄호로 적힌 텍스트

import { KANJI } from './ruby'

const KANA_ONLY = /^[ぁ-ゟ゠-ヿー・]+$/
const BLOCK = new Set(['P', 'DIV', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'BLOCKQUOTE'])
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'RP', 'BUTTON'])

const hasClass = (el: Element, c: string) => el.classList?.contains(c)

function joinReading(base: string, reading: string) {
  const b = base.trim()
  const r = reading.trim()
  if (!b) return ''
  if (!r || !KANJI.test(b)) return b
  return `${b}{${r}}`
}

/** 붙여넣은 HTML → 漢字{かんじ} 표기 텍스트. 후리가나가 하나도 없으면 null */
export function htmlToRuby(html: string): string | null {
  if (typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let found = false

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/[\r\n\t]+/g, '')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    const tag = el.tagName
    if (SKIP.has(tag)) return ''
    if (tag === 'BR') return '\n'
    if (tag === 'RT' || hasClass(el, 'rt')) return ''

    // <ruby>漢字<rt>かんじ</rt></ruby>
    if (tag === 'RUBY') {
      let base = ''
      let reading = ''
      el.childNodes.forEach((c) => {
        const ce = c as Element
        if (c.nodeType === Node.ELEMENT_NODE && (ce.tagName === 'RT' || hasClass(ce, 'rt'))) reading += ce.textContent ?? ''
        else if (!(c.nodeType === Node.ELEMENT_NODE && ce.tagName === 'RP')) base += walk(c)
      })
      if (reading.trim()) found = true
      return joinReading(base, reading)
    }

    // <span class="ruby"><span class="rb">漢字</span><span class="rt">かんじ</span></span>
    const rb = Array.from(el.children).find((c) => hasClass(c, 'rb'))
    const rt = Array.from(el.children).find((c) => hasClass(c, 'rt'))
    if (rb && rt) {
      let out = ''
      el.childNodes.forEach((c) => {
        if (c === rb) {
          found = true
          out += joinReading(rb.textContent ?? '', rt.textContent ?? '')
        } else if (c !== rt) out += walk(c)
      })
      return out
    }

    let inner = ''
    el.childNodes.forEach((c) => (inner += walk(c)))
    return BLOCK.has(tag) ? `\n${inner}\n` : inner
  }

  const text = walk(doc.body)
    .split('\n')
    .map((s) => s.replace(/[ 　]+/g, (m) => (m.length > 1 ? ' ' : m)).trim())
    .filter(Boolean)
    .join('\n')
  return found ? text : null
}

/** 漢字(かんじ)·漢字（かんじ） → 漢字{かんじ}. 괄호 안이 가나이고 바로 앞이 한자일 때만 바꿔요 */
export function parenToRuby(text: string) {
  return text.replace(/([㐀-鿿豈-﫿々〆ヶ]+)[(（]([^()（）\n]+)[)）]/g, (m, kan: string, r: string) => (KANA_ONLY.test(r.trim()) ? `${kan}{${r.trim()}}` : m))
}

/** 줄의 한자에 전부 읽기가 붙어 있는지 */
export function fullyRead(ruby: string, split: (s: string) => { kanji: boolean; reading?: string }[]) {
  return split(ruby).every((g) => !g.kanji || !!g.reading)
}
