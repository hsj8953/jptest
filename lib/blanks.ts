// 쉬움·보통 난이도의 빈칸 만들기
// - 빈칸은 한자 단어 위주 (단어장에 있는 단어를 먼저), 한자가 없는 문장은 가타카나·히라가나 단어
// - 문장마다 1개, 한자가 많고 긴 문장은 2개
// - 같은 곡이면 누가 언제 열어도 항상 같은 빈칸이 나와요

import { answerOf, normalizeAnswer, normalizeKanji, splitRuby } from './ruby'
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
    while (to + 2 < segs.length && !segs[to + 1].kanji && KANA_GLUE.test(segs[to + 1].text) && segs[to + 2].kanji) to += 2
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

// 한자가 없는 문장용: 조사·어미처럼 너무 짧거나 빈칸으로 의미 없는 말은 빼요
const SKIP_KANA = new Set(['から', 'まで', 'より', 'です', 'ます', 'でも', 'けど', 'ので', 'のに', 'だけ', 'ほど', 'など', 'って', 'だよ', 'だね', 'よね', 'かな', 'ない', 'いる', 'ある', 'する', 'なる', 'この', 'その', 'あの', 'それ', 'これ', 'あれ'])
const KATA = /[\u30A0-\u30FF]/

/** 한자가 없는 문장의 빈칸 후보: 가타카나 단어 먼저, 없으면 두 글자 이상 히라가나 단어 */
function kanaUnits(text: string) {
  type U = { start: number; end: number; text: string }
  const out: U[] = []
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (t: string) => Iterable<{ segment: string; index: number; isWordLike?: boolean }> } }).Segmenter
  if (Seg) {
    for (const w of new Seg('ja', { granularity: 'word' }).segment(text)) {
      if (!w.isWordLike) continue
      const t = w.segment
      if (Array.from(t).length < 2 || SKIP_KANA.has(t) || !/^[\u3041-\u309F\u30A0-\u30FFー]+$/.test(t)) continue
      out.push({ start: w.index, end: w.index + t.length, text: t })
    }
  } else {
    // 단어 나누기를 못 쓰는 오래된 브라우저: 가타카나 덩어리만
    for (const m of text.matchAll(/[\u30A0-\u30FFー]{2,}/g)) out.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[0] })
  }
  return out
}

function kanaBlanks(song: Song, lineIndex: number, text: string): BlankLine {
  const us = kanaUnits(text)
  if (!us.length) return { parts: [{ text }], answers: [] }
  const want = us.length >= 3 && Array.from(text).length >= 12 ? 2 : 1
  const picked = us
    .map((u, k) => ({ u, k, score: (KATA.test(u.text) ? 100 : 0) + Array.from(u.text).length * 10 + (hash(`${song.id}:${lineIndex}:${u.text}:${k}`) % 10) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, want)
    .sort((a, b) => a.k - b.k)
    .map((x) => x.u)
  const parts: BlankPart[] = []
  let pos = 0
  picked.forEach((u, n) => {
    if (u.start > pos) parts.push({ text: text.slice(pos, u.start) })
    parts.push({ text: u.text, blank: n })
    pos = u.end
  })
  if (pos < text.length) parts.push({ text: text.slice(pos) })
  return { parts, answers: picked.map((u) => ({ text: u.text, reading: toHiraStr(u.text) })) }
}

export function blanksFor(song: Song, lineIndex: number): BlankLine {
  const line = song.lines[lineIndex]
  const { segs, units: us } = units(line?.ruby ?? '')
  // 한자가 없는 문장은 가나 단어로 빈칸을 만들어요
  if (!us.length) return kanaBlanks(song, lineIndex, answerOf(line?.ruby ?? ''))
  const words = (song.words ?? []).map((w) => w.word)
  const len = answerOf(line.ruby).length
  const want = us.length >= 3 && len >= 12 ? 2 : 1
  const picked = us
    .map((u, k) => ({
      u,
      k,
      score: (words.some((w) => w.includes(u.text) || u.text.includes(w)) ? 100 : 0) + u.text.length * 10 + (hash(`${song.id}:${lineIndex}:${u.text}`) % 10),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, want)
    .sort((a, b) => a.k - b.k)
    .map((x) => x.u)

  const parts: BlankPart[] = []
  let buf = ''
  let i = 0
  picked.forEach((u, n) => {
    while (i < u.from) buf += segs[i++].text
    if (buf) parts.push({ text: buf })
    buf = ''
    parts.push({ text: u.text, blank: n })
    i = u.to + 1
  })
  while (i < segs.length) buf += segs[i++].text
  if (buf) parts.push({ text: buf })
  return { parts, answers: picked.map((u) => ({ text: u.text, reading: u.reading })) }
}

/** 이 난이도에서 채점하는 문장 번호들 (쉬움·보통은 빈칸이 있는 문장만) */
export function gradedLines(song: Song, d: Difficulty) {
  return song.lines.map((_, i) => i).filter((i) => d === 'hard' || blanksFor(song, i).answers.length > 0)
}

const toHiraStr = (s: string) => s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
const FALLBACK_KANA = ['さよなら', 'ありがとう', 'メロディ', 'いつか', 'きっと', 'ずっと', 'どこか', 'もう一度', 'ひとり', 'ふたり']

const FALLBACK = ['心', '夢', '空', '花', '雨', '光', '声', '涙', '時間', '世界', '明日', '未来', '季節', '言葉', '景色']

/** 쉬움 모드 보기 4개 (정답 + 같은 곡의 다른 한자 단어) */
export function choicesFor(song: Song, lineIndex: number, blank: number) {
  const all = blanksFor(song, lineIndex).answers
  const answer = all[blank]?.text ?? ''
  // 한자 빈칸이면 한자 단어끼리, 가나 빈칸이면 가나 단어끼리 섞어요
  const kanaMode = !/[\u3400-\u9FFF々]/.test(answer)
  const pool = new Set<string>()
  song.lines.forEach((l) => {
    if (kanaMode) kanaUnits(answerOf(l.ruby)).forEach((u) => pool.add(u.text))
    else units(l.ruby).units.forEach((u) => pool.add(u.text))
  })
  // 같은 문장의 다른 빈칸 정답은 보기에서 빼요 (헷갈리지 않게)
  all.forEach((a) => pool.delete(a.text))
  const seed = hash(`${song.id}:${lineIndex}:${blank}`)
  const ranked = [...pool].sort((a, b) => {
    const da = Math.abs(a.length - answer.length)
    const db = Math.abs(b.length - answer.length)
    return da - db || (hash(a + seed) % 997) - (hash(b + seed) % 997)
  })
  const picks = ranked.slice(0, 3)
  for (const f of kanaMode ? FALLBACK_KANA : FALLBACK) {
    if (picks.length >= 3) break
    if (f !== answer && !picks.includes(f) && !all.some((a) => a.text === f)) picks.push(f)
  }
  // 보기 순서도 항상 같게 섞어요
  return [answer, ...picks].sort((a, b) => (hash(a + seed + 'o') % 1009) - (hash(b + seed + 'o') % 1009))
}

const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

/** 보통 모드 채점: 한자로 써도, 히라가나(가타카나)로 써도 정답 */
export function blankCorrect(input: string, ans: { text: string; reading: string }) {
  const v = normalizeAnswer(input).replace(/\s+/g, '')
  if (!v) return false
  return v === normalizeAnswer(ans.text) || toHira(v) === toHira(ans.reading)
}
