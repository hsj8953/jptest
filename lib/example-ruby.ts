// 예문 후리가나 고르기: AI가 붙인 것과 사전(kuromoji)이 붙인 것 중에 더 믿을 만한 쪽을 골라요.
//
// AI는 문맥은 잘 읽지만(辛{から}い, 一人{ひとり}) 읽기를 자주 잘못 나눠요(明{あ}日, 話{は}せる, 手{て}本{ほん}, 言{い}葉{ば}).
// 사전은 나누기는 정확하지만 문맥을 가끔 틀려요(辛{つら}い料理, 一{いち}人{にん}).
// 그래서 이렇게 골라요:
//   1) 문장 전체 읽기가 같으면 → 사전 (나누기가 깔끔해요)
//   2) 다르면 → AI 표기가 멀쩡할 때만 AI, 아니면 사전
//      멀쩡하다 = 모든 한자에 읽기가 있고, 그 읽기가 한자 읽기 사전(KANJIDIC)으로 말이 되고,
//                사전이 한 단어로 본 한자 덩어리(言葉)를 글자마다 쪼개지 않았을 때

import { splitRuby } from './ruby'

/** 한자 한 글자 → 가능한 읽기들 (public/kanji-readings.json) */
export type KanjiReadings = Map<string, string[]>

const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

type Run = { start: number; end: number; text: string; reading: string | undefined }
function runsOf(ruby: string) {
  const runs: Run[] = []
  let pos = 0
  let full = ''
  for (const g of splitRuby(ruby)) {
    if (g.kanji) runs.push({ start: pos, end: pos + g.text.length, text: g.text, reading: g.reading })
    full += g.kanji ? toHira(g.reading ?? '?') : toHira(g.text)
    pos += g.text.length
  }
  return { runs, full }
}

/** 이 한자 덩어리를 이렇게 읽을 수 있는지 (글자마다 읽기 사전에 있는 읽기를 이어 붙여서 만들 수 있는지) */
export function canRead(text: string, reading: string, kd: KanjiReadings) {
  const chars = Array.from(text)
  const r = toHira(reading)
  const memo = new Map<number, boolean>()
  const go = (i: number, p: number): boolean => {
    if (i === chars.length) return p === r.length
    const key = i * 1000 + p
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    const ch = chars[i] === '々' && i > 0 ? chars[i - 1] : chars[i]
    const opts = kd.get(ch)
    let ok = false
    if (!opts) {
      // 사전에 없는 글자는 1~4글자 아무 읽기나 허용
      for (let n = 1; n <= 4 && p + n <= r.length && !ok; n++) ok = go(i + 1, p + n)
    } else {
      for (const o of opts) {
        if (r.startsWith(o, p) && go(i + 1, p + o.length)) {
          ok = true
          break
        }
      }
    }
    memo.set(key, ok)
    return ok
  }
  return go(0, 0)
}

/**
 * ai: AI가 준 예문(후리가나 포함), dict: 같은 문장에 사전으로 붙인 후리가나.
 * kd가 없으면(읽기 사전을 못 불러옴) 읽기가 다를 때 사전 쪽을 써요.
 */
export function chooseRuby(ai: string, dict: string, kd?: KanjiReadings | null) {
  const d = runsOf(dict)
  // 사전이 못 읽은 한자가 있으면 사전 것은 못 써요
  if (d.runs.some((x) => !x.reading)) return ai
  const a = runsOf(ai)
  if (a.full === d.full) return dict
  const wellFormed = a.runs.length > 0 && a.runs.every((x) => !!x.reading)
  if (!wellFormed || !kd?.size) return dict
  // 사전이 한 단어로 읽은 한자 덩어리(두 글자 이상)를 AI가 쪼갰으면 AI가 틀렸을 가능성이 커요
  const splitCompound = d.runs.some((x) => x.end - x.start >= 2 && a.runs.filter((y) => y.start >= x.start && y.end <= x.end).length >= 2)
  if (splitCompound) return dict
  return a.runs.every((x) => canRead(x.text, x.reading!, kd)) ? ai : dict
}
