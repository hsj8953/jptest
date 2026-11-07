'use client'

// 따라 말하기(섀도잉): 브라우저 음성 인식 + 소리(읽기)로 비교
import { parseRuby, normalizeKanji } from './ruby'
import { readingMap } from './blanks'
import { diffChars } from './diff'
import type { Song } from './types'

export type Recognizer = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

/** 브라우저 음성 인식 (크롬·사파리는 webkit 접두사). 없으면 null */
export function getRecognizer(): (new () => Recognizer) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognizer) | null
}
export const canRecord = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

export const SPEECH_ERR: Record<string, string> = {
  'not-allowed': '마이크 권한이 막혀 있어요. 주소창 옆 자물쇠(또는 ⓘ) 아이콘에서 마이크를 허용해 주세요.',
  'no-speech': '소리가 안 들렸어요. 마이크에 조금 더 가까이 말해 보세요.',
  'audio-capture': '마이크를 찾지 못했어요.',
  network: '인식 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요. (아이폰은 설정에서 Siri 및 받아쓰기를 켜 주세요)',
  'language-not-supported': '이 브라우저는 일본어 인식을 지원하지 않아요.',
}

const KANJI = /[㐀-鿿々〆]/
const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
// 소리 비교에 안 쓰는 것: 띄어쓰기, 문장부호, 기호
const clean = (s: string) =>
  toHira(normalizeKanji(s).normalize('NFKC'))
    .toLowerCase()
    .replace(/[\s　、。，．,.!?！？・「」『』（）()〜~…‥♪☆★'"“”‘’\-]/g, '')

const keyCache = new WeakMap<Song, { map: Map<string, string>; max: number }>()
function keys(song: Song) {
  let k = keyCache.get(song)
  if (!k) {
    const map = new Map<string, string>()
    let max = 1
    // 가사 후리가나 (한 글자씩 달린 것도 포함) + 단어장
    for (const l of song.lines) for (const p of parseRuby(l.ruby)) if (p.reading && KANJI.test(p.text)) map.set(clean(p.text), clean(p.reading))
    for (const [t, r] of readingMap(song)) if (KANJI.test(t) && r && !map.has(clean(t))) map.set(clean(t), clean(r))
    for (const t of map.keys()) max = Math.max(max, Array.from(t).length)
    k = { map, max }
    keyCache.set(song, k)
  }
  return k
}

/** 글자를 소리(히라가나)로: 한자는 이 곡 가사·단어장의 읽기로 바꿔요. 모르는 한자는 그대로 둬요 */
export function toReading(song: Song, text: string) {
  const { map, max } = keys(song)
  const cs = Array.from(clean(text))
  let out = ''
  for (let i = 0; i < cs.length; ) {
    if (!KANJI.test(cs[i])) {
      out += cs[i++]
      continue
    }
    let hit = 0
    for (let n = Math.min(max, cs.length - i); n >= 1; n--) {
      const r = map.get(cs.slice(i, i + n).join(''))
      if (r) {
        out += r
        hit = n
        break
      }
    }
    if (hit) i += hit
    else out += cs[i++]
  }
  return out
}

/** 가사 한 줄의 소리 (후리가나가 있으면 그걸로) */
export function lineReading(song: Song, ruby: string) {
  return parseRuby(ruby).map((p) => (p.reading ? clean(p.reading) : toReading(song, p.text))).join('')
}

/** 원문 소리 vs 내가 말한 소리 비교. score: 원문 소리 중 맞게 말한 비율(0~100) */
export function compareSpeech(song: Song, ruby: string, said: string) {
  const target = lineReading(song, ruby)
  const mine = toReading(song, said)
  const d = diffChars(target, mine)
  const hit = d.ans.filter((c) => !c.bad).length
  // 원문에 없는 소리를 더 말한 것도 조금 깎아요
  const extra = d.inp.filter((c) => c.bad).length
  const score = target.length ? Math.max(0, Math.round(((hit - extra * 0.5) / target.length) * 100)) : 0
  return { target, mine, ans: d.ans, inp: d.inp, score }
}
