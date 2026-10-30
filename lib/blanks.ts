// 쉬움·보통 난이도의 빈칸 만들기
// - 빈칸은 한자 단어 위주 (단어장에 있는 단어를 먼저), 한자가 없는 문장은 가타카나·히라가나 단어
// - 한자 → 가타카나 → 히라가나 → 영어 순으로, 문장 길이에 따라 1~3개
// - 같은 곡이면 누가 언제 열어도 항상 같은 빈칸이 나와요

import { normalizeAnswer, normalizeKanji, splitRuby } from './ruby'
import type { Difficulty, Song } from './types'

export type BlankPart = { text: string; blank?: number }
export type BlankLine = {
  /** 문장을 조각으로 나눈 것. blank 번호가 있는 조각이 빈칸이에요 */
  parts: BlankPart[]
  /** 빈칸 정답들 (순서대로) */
  answers: { text: string; reading: string }[]
}

// 帰り道·落ち葉·話し声처럼 한자 사이에 끼는 한 글자 가나만 이어 붙여요 (조사 に·が·の 등은 제외)
const KANA_GLUE = /^[りちきしみえけれせ]$/
// 읽기가 없는 한자 덩어리는 飛び方·過ぎ去る처럼 동사 연용형 한 글자도 이어 붙여요
const KANA_GLUE_LOOSE = /^[りちきしみえけれせびぎ]$/

function hash(s: string) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h
}

/** 한 문장의 빈칸 후보: 한자 덩어리 (帰り道처럼 짧은 가나로 이어진 한자는 한 덩어리) */
function units(ruby: string) {
  const segs = splitRuby(normalizeKanji(ruby))
  const out: { from: number; to: number; text: string; reading: string }[] = []
  for (let i = 0; i < segs.length; i++) {
    if (!segs[i].kanji) continue
    let to = i
    while (to + 2 < segs.length && !segs[to + 1].kanji && KANA_GLUE_LOOSE.test(segs[to + 1].text) && segs[to + 2].kanji) to += 2
    const part = segs.slice(i, to + 1)
    // 읽기가 빠진 한자가 있으면 빈칸으로 쓰지 않아요 (보통 모드에서 히라가나 정답을 알 수 없어서)
    if (part.some((g) => g.kanji && !g.reading)) {
      i = to
      continue
    }
    out.push({ from: i, to, text: part.map((g) => g.text).join(''), reading: part.map((g) => (g.kanji ? g.reading : g.text)).join('') })
    i = to
  }
  return { segs, units: out }
}

// 빈칸으로 의미 없는 짧은 말(조사·어미·지시어)은 빼요
const SKIP_KANA = new Set(['から', 'まで', 'より', 'です', 'ます', 'でも', 'けど', 'ので', 'のに', 'だけ', 'ほど', 'など', 'って', 'だよ', 'だね', 'よね', 'かな', 'ない', 'いる', 'ある', 'する', 'なる', 'この', 'その', 'あの', 'それ', 'これ', 'あれ', 'なら', 'たい', 'たら', 'だろう', 'でしょう', 'んだ', 'のよ', 'のね', 'ても', 'では', 'には', 'とは', 'ねえ', 'ため'])
const KATA = /[\u30A0-\u30FF]/
const KANJI_CH = /[\u3400-\u9FFF々〆]/
const KANA_WORD = /^[\u3041-\u309F\u30A0-\u30FFー]+$/
const LATIN_WORD = /^[A-Za-z][A-Za-z']+$/
const SKIP_LATIN = new Set(['the', 'and', 'you', 'are', 'for', 'but', 'not', 'yeah', 'its', "it's"])

type Seg = { segment: string; index: number; isWordLike?: boolean }
const Segmenter = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (t: string) => Iterable<Seg> } }).Segmenter

/** 가나·영어 단어 후보 (한자 옆에 붙은 오쿠리가나 조각은 빼요) */
function wordUnits(text: string) {
  const out: { start: number; end: number; text: string; kind: 'kata' | 'hira' | 'latin' }[] = []
  const push = (start: number, t: string) => {
    const end = start + t.length
    if (KANA_WORD.test(t)) {
      if (Array.from(t).length < 2 || SKIP_KANA.has(t)) return
      // 会いたい의 いたい처럼 한자 바로 뒤에 붙은 히라가나는 단어가 아니라 어미예요
      if (!KATA.test(t) && start > 0 && KANJI_CH.test(text[start - 1])) return
      out.push({ start, end, text: t, kind: KATA.test(t) ? 'kata' : 'hira' })
    } else if (LATIN_WORD.test(t) && t.length >= 3 && !SKIP_LATIN.has(t.toLowerCase())) {
      out.push({ start, end, text: t, kind: 'latin' })
    }
  }
  if (Segmenter) {
    for (const w of new Segmenter('ja', { granularity: 'word' }).segment(text)) if (w.isWordLike !== false) push(w.index, w.segment)
  } else {
    for (const m of text.matchAll(/[\u30A0-\u30FFー]{2,}|[A-Za-z']{3,}/g)) push(m.index ?? 0, m[0])
  }
  return out
}

type Cand = { start: number; end: number; text: string; reading: string; score: number }

/** 한 문장의 빈칸 후보 전부 (한자 단어 + 가나 단어 + 영어 단어) */
function candidates(song: Song, lineIndex: number, ruby: string) {
  const { segs, units: ku } = units(ruby)
  const offs: number[] = []
  let text = ''
  segs.forEach((g) => { offs.push(text.length); text += g.text })
  const words = (song.words ?? []).map((w) => w.word)
  const h = (t: string, k: number) => hash(`${song.id}:${lineIndex}:${t}:${k}`) % 10
  const cands: Cand[] = []
  const covered = new Array(text.length).fill(false)
  ku.forEach((u, k) => {
    const start = offs[u.from]
    const end = offs[u.to] + segs[u.to].text.length
    for (let c = start; c < end; c++) covered[c] = true
    cands.push({ start, end, text: u.text, reading: u.reading, score: 300 + (words.some((w) => w.includes(u.text) || u.text.includes(w)) ? 100 : 0) + u.text.length * 10 + h(u.text, k) })
  })
  // 읽기가 빠진 한자도 빈칸으로 써요 (飛び方처럼 이어진 덩어리째, 보통 모드에선 한자로만 정답)
  for (let i = 0; i < segs.length; i++) {
    if (!segs[i].kanji || covered[offs[i]]) continue
    let to = i
    while (to + 2 < segs.length && !segs[to + 1].kanji && KANA_GLUE_LOOSE.test(segs[to + 1].text) && segs[to + 2].kanji && !covered[offs[to + 2]]) to += 2
    const start = offs[i]
    const end = offs[to] + segs[to].text.length
    for (let c = start; c < end; c++) covered[c] = true
    const t = text.slice(start, end)
    cands.push({ start, end, text: t, reading: '', score: 150 + Array.from(t).length * 10 + h(t, i) })
    i = to
  }
  wordUnits(text).forEach((u, k) => {
    for (let c = u.start; c < u.end; c++) if (covered[c]) return
    const base = u.kind === 'kata' ? 200 : u.kind === 'hira' ? 100 : 50
    cands.push({ start: u.start, end: u.end, text: u.text, reading: u.kind === 'latin' ? '' : toHiraStr(u.text), score: base + Array.from(u.text).length * 10 + h(u.text, k) })
  })
  return { text, cands }
}

export function blanksFor(song: Song, lineIndex: number): BlankLine {
  const ruby = song.lines[lineIndex]?.ruby ?? ''
  const { text, cands } = candidates(song, lineIndex, ruby)
  if (!cands.length) return { parts: [{ text }], answers: [] }
  // 문장 길이에 따라 1~3개
  const len = Array.from(text.replace(/\s/g, '')).length
  const want = Math.min(cands.length, len >= 16 ? 3 : len >= 6 ? 2 : 1)
  const picked = [...cands].sort((a, b) => b.score - a.score).slice(0, want).sort((a, b) => a.start - b.start)
  const parts: BlankPart[] = []
  let pos = 0
  picked.forEach((u, n) => {
    if (u.start > pos) parts.push({ text: text.slice(pos, u.start) })
    parts.push({ text: u.text, blank: n })
    pos = u.end
  })
  if (pos < text.length) parts.push({ text: text.slice(pos) })
  return { parts, answers: picked.map((u) => ({ text: u.text, reading: u.reading })) }
}

/** 이 난이도에서 채점하는 문장 번호들 (쉬움·보통은 빈칸이 있는 문장만) */
export function gradedLines(song: Song, d: Difficulty) {
  return song.lines.map((_, i) => i).filter((i) => d === 'hard' || blanksFor(song, i).answers.length > 0)
}

const toHiraStr = (s: string) => s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
const FALLBACK_KANA = ['さよなら', 'ありがとう', 'メロディ', 'いつか', 'きっと', 'ずっと', 'どこか', 'もう一度', 'ひとり', 'ふたり']

const FALLBACK_LATIN = ['love', 'dream', 'heart', 'baby', 'forever', 'tonight', 'smile', 'shine']

const FALLBACK = ['心', '夢', '空', '花', '雨', '光', '声', '涙', '時間', '世界', '明日', '未来', '季節', '言葉', '景色']
const FALLBACK_READING: Record<string, string> = { 心: 'こころ', 夢: 'ゆめ', 空: 'そら', 花: 'はな', 雨: 'あめ', 光: 'ひかり', 声: 'こえ', 涙: 'なみだ', 時間: 'じかん', 世界: 'せかい', 明日: 'あした', 未来: 'みらい', 季節: 'きせつ', 言葉: 'ことば', 景色: 'けしき' }

const readingCache = new WeakMap<Song, Map<string, string>>()
/** 이 곡에 나오는 한자 단어 → 읽기 (가사 후리가나, 단어장, 기본 단어 순) */
export function readingMap(song: Song) {
  const hit = readingCache.get(song)
  if (hit) return hit
  const m = new Map<string, string>()
  const add = (t: string, r?: string) => { if (r && !m.get(t)) m.set(t, r) }
  song.lines.forEach((l) => units(l.ruby).units.forEach((u) => add(u.text, u.reading)))
  ;(song.words ?? []).forEach((w) => add(w.word, w.reading))
  Object.entries(FALLBACK_READING).forEach(([t, r]) => add(t, r))
  readingCache.set(song, m)
  return m
}
/** 보기 위에 달 후리가나 (한자가 없거나 읽기를 모르면 빈 문자열) */
export function choiceReading(song: Song, text: string) {
  return /[\u3400-\u9FFF々]/.test(text) ? readingMap(song).get(text) ?? '' : ''
}

/** 쉬움 모드 보기 4개 (정답 + 같은 곡의 다른 한자 단어) */
export function choicesFor(song: Song, lineIndex: number, blank: number) {
  const all = blanksFor(song, lineIndex).answers
  const answer = all[blank]?.text ?? ''
  // 한자 빈칸이면 한자 단어끼리, 가나 빈칸이면 가나 단어끼리 섞어요
  const kanaMode = !/[\u3400-\u9FFF々]/.test(answer)
  const pool = new Set<string>()
  const latin = /^[A-Za-z']+$/.test(answer)
  const kind = (t: string) => (/^[A-Za-z']+$/.test(t) ? 'latin' : /[\u3400-\u9FFF々]/.test(t) ? 'kanji' : 'kana')
  const want = kind(answer)
  song.lines.forEach((_, i) => candidates(song, i, song.lines[i].ruby).cands.forEach((c) => { if (kind(c.text) === want) pool.add(c.text) }))
  // 같은 문장의 다른 빈칸 정답은 보기에서 빼요 (헷갈리지 않게, 영어는 대소문자 무시)
  const same = new Set(all.map((a) => a.text.toLowerCase()))
  for (const t of [...pool]) if (same.has(t.toLowerCase())) pool.delete(t)
  const seed = hash(`${song.id}:${lineIndex}:${blank}`)
  const rm = readingMap(song)
  const ranked = [...pool].sort((a, b) => {
    // 한자 보기는 후리가나를 달 수 있는 단어를 먼저 써요
    if (want === 'kanji' && rm.has(a) !== rm.has(b)) return rm.has(a) ? -1 : 1
    const da = Math.abs(a.length - answer.length)
    const db = Math.abs(b.length - answer.length)
    return da - db || (hash(a + seed) % 997) - (hash(b + seed) % 997)
  })
  const picks = ranked.slice(0, 3)
  for (const f of latin ? FALLBACK_LATIN : kanaMode ? FALLBACK_KANA : FALLBACK) {
    if (picks.length >= 3) break
    if (!same.has(f.toLowerCase()) && !picks.includes(f)) picks.push(f)
  }
  // 보기 순서도 항상 같게 섞어요
  return [answer, ...picks].sort((a, b) => (hash(a + seed + 'o') % 1009) - (hash(b + seed + 'o') % 1009))
}

const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

/** 보통 모드 채점: 한자로 써도, 히라가나(가타카나)로 써도 정답 */
export function blankCorrect(input: string, ans: { text: string; reading: string }) {
  const v = normalizeAnswer(input).replace(/\s+/g, '')
  if (!v) return false
  const t = normalizeAnswer(ans.text).replace(/\s+/g, '')
  if (v.toLowerCase() === t.toLowerCase()) return true
  return !!ans.reading && toHira(v) === toHira(ans.reading)
}
