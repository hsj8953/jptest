// 히라가나·가타카나 표 데이터 (빈 칸은 null)
export type KanaCell = { kana: string; romaji: string } | null
export type KanaGroup = { id: 'basic' | 'voiced' | 'combo'; title: string; cols: number; rows: KanaCell[][] }

const c = (kana: string, romaji: string): KanaCell => ({ kana, romaji })

const BASIC: KanaCell[][] = [
  [c('あ', 'a'), c('い', 'i'), c('う', 'u'), c('え', 'e'), c('お', 'o')],
  [c('か', 'ka'), c('き', 'ki'), c('く', 'ku'), c('け', 'ke'), c('こ', 'ko')],
  [c('さ', 'sa'), c('し', 'shi'), c('す', 'su'), c('せ', 'se'), c('そ', 'so')],
  [c('た', 'ta'), c('ち', 'chi'), c('つ', 'tsu'), c('て', 'te'), c('と', 'to')],
  [c('な', 'na'), c('に', 'ni'), c('ぬ', 'nu'), c('ね', 'ne'), c('の', 'no')],
  [c('は', 'ha'), c('ひ', 'hi'), c('ふ', 'fu'), c('へ', 'he'), c('ほ', 'ho')],
  [c('ま', 'ma'), c('み', 'mi'), c('む', 'mu'), c('め', 'me'), c('も', 'mo')],
  [c('や', 'ya'), null, c('ゆ', 'yu'), null, c('よ', 'yo')],
  [c('ら', 'ra'), c('り', 'ri'), c('る', 'ru'), c('れ', 're'), c('ろ', 'ro')],
  // 한 화면에 들어가게 ん을 わ 줄에 같이 넣어요
  [c('わ', 'wa'), null, c('を', 'wo'), null, c('ん', 'n')],
]

const VOICED: KanaCell[][] = [
  [c('が', 'ga'), c('ぎ', 'gi'), c('ぐ', 'gu'), c('げ', 'ge'), c('ご', 'go')],
  [c('ざ', 'za'), c('じ', 'ji'), c('ず', 'zu'), c('ぜ', 'ze'), c('ぞ', 'zo')],
  [c('だ', 'da'), c('ぢ', 'ji'), c('づ', 'zu'), c('で', 'de'), c('ど', 'do')],
  [c('ば', 'ba'), c('び', 'bi'), c('ぶ', 'bu'), c('べ', 'be'), c('ぼ', 'bo')],
  [c('ぱ', 'pa'), c('ぴ', 'pi'), c('ぷ', 'pu'), c('ぺ', 'pe'), c('ぽ', 'po')],
]

const COMBO_BASE: [string, string][] = [
  ['き', 'ky'], ['し', 'sh'], ['ち', 'ch'], ['に', 'ny'], ['ひ', 'hy'], ['み', 'my'], ['り', 'ry'],
  ['ぎ', 'gy'], ['じ', 'j'], ['び', 'by'], ['ぴ', 'py'],
]
const COMBO_ROWS = COMBO_BASE.map(([k, r]) => [c(k + 'ゃ', r + 'a'), c(k + 'ゅ', r + 'u'), c(k + 'ょ', r + 'o')])
// 한 화면에 들어가게 두 묶음씩 나란히 (6칸)
const COMBO: KanaCell[][] = []
for (let i = 0; i < COMBO_ROWS.length; i += 2) COMBO.push([...COMBO_ROWS[i], ...(COMBO_ROWS[i + 1] ?? [null, null, null])])

export const HIRAGANA: KanaGroup[] = [
  { id: 'basic', title: '청음 (기본)', cols: 5, rows: BASIC },
  { id: 'voiced', title: '탁음 · 반탁음', cols: 5, rows: VOICED },
  { id: 'combo', title: '요음', cols: 6, rows: COMBO },
]

/** 히라가나 → 가타카나 */
export const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))

export const KATAKANA: KanaGroup[] = HIRAGANA.map((g) => ({
  ...g,
  rows: g.rows.map((row) => row.map((cell) => (cell ? { ...cell, kana: toKatakana(cell.kana) } : null))),
}))

export const cellsOf = (groups: KanaGroup[]) => groups.flatMap((g) => g.rows.flat().filter((x): x is NonNullable<KanaCell> => !!x))
