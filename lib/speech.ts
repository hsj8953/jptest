'use client'

// 따라 말하기(섀도잉): 브라우저 음성 인식 + 소리(읽기)로 비교
import { parseRuby, normalizeKanji } from './ruby'
import { readingMap } from './blanks'
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

/* ── 한자 읽기 사전 (곡에 없는 한자용) ─────────────────────────
   public/kanji-readings.json: KANJIDIC2 (EDRDG, CC BY-SA 4.0)에서 상용·인명용 한자의 음독·훈독만 뽑은 것.
   예) 金: かね,きん,こん… / 鐘: かね,しょう… → 鐘을 金으로 받아 적어도 소리가 같으면 맞게 쳐요. */
export type KanjiDict = Map<string, string[]>
let dictPromise: Promise<KanjiDict> | null = null
export function loadKanjiDict(): Promise<KanjiDict> {
  dictPromise ??= fetch('/kanji-readings.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((o: Record<string, string>) => new Map(Object.entries(o).map(([k, v]) => [k, v.split(',')])))
    .catch(() => {
      dictPromise = null
      return new Map()
    })
  return dictPromise
}

type Tok = { c: string; read?: string[] } // read: 곡에서 읽기를 못 찾은 한자의 후보 읽기

/** 내가 말한 문장 → 소리 조각들 (곡에서 읽기를 아는 한자는 히라가나로, 모르는 한자는 사전 읽기 후보와 함께) */
function speechTokens(song: Song, said: string, dict?: KanjiDict): Tok[] {
  const { map, max } = keys(song)
  const cs = Array.from(clean(said))
  const out: Tok[] = []
  for (let i = 0; i < cs.length; ) {
    if (!KANJI.test(cs[i])) {
      out.push({ c: cs[i++] })
      continue
    }
    let hit = 0
    for (let n = Math.min(max, cs.length - i); n >= 1; n--) {
      const r = map.get(cs.slice(i, i + n).join(''))
      if (r) {
        for (const ch of Array.from(r)) out.push({ c: ch })
        hit = n
        break
      }
    }
    if (hit) i += hit
    else {
      out.push({ c: cs[i], read: dict?.get(cs[i]) ?? [] })
      i++
    }
  }
  return out
}

export type Mark = { c: string; bad?: boolean }

/**
 * 원문 소리 vs 내가 말한 소리 비교 (편집 거리 맞추기).
 * 곡에서 읽기를 모르는 한자는, 원문의 그 자리 소리가 그 한자의 읽기 중 하나와 같으면 맞은 걸로 쳐요.
 * score: 원문 소리 중 맞게 말한 비율(0~100)
 */
export function compareSpeech(song: Song, ruby: string, said: string, dict?: KanjiDict) {
  const T = Array.from(lineReading(song, ruby))
  const M = speechTokens(song, said, dict)
  const n = T.length
  const m = M.length
  const INF = 1e9
  // dp[i][j]: 원문 i글자, 내 소리 j조각까지 맞췄을 때 최소 비용
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF))
  const how = Array.from({ length: n + 1 }, () => new Int16Array(m + 1)) // 0 시작, 1 같음, 2 바뀜, 3 빠짐(원문만), 4 더함(내 것만), 10+k 한자가 원문 k글자와 맞음
  dp[0][0] = 0
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      const d = dp[i][j]
      if (d >= INF) continue
      const up = (ii: number, jj: number, cost: number, h: number) => {
        if (d + cost < dp[ii][jj]) {
          dp[ii][jj] = d + cost
          how[ii][jj] = h
        }
      }
      if (i < n) up(i + 1, j, 1, 3)
      if (j < m) up(i, j + 1, 1, 4)
      if (i < n && j < m) {
        const t = M[j]
        if (t.read) {
          // 모르는 한자: 읽기 후보와 원문 소리를 맞춰 봐요
          for (const r of t.read) {
            const k = Array.from(r).length
            if (k && i + k <= n && T.slice(i, i + k).join('') === r) up(i + k, j + 1, 0, 10 + k)
          }
          up(i + 1, j + 1, 1, 2)
        } else up(i + 1, j + 1, T[i] === t.c ? 0 : 1, T[i] === t.c ? 1 : 2)
      }
    }
  // 거꾸로 따라가며 표시를 만들어요
  const ans: Mark[] = []
  const inp: Mark[] = []
  let i = n
  let j = m
  let added = 0 // 원문에 없는 소리를 더 말한 개수
  while (i > 0 || j > 0) {
    const h = how[i][j]
    if (h === 1 || h === 2) {
      const ok = h === 1
      ans.unshift({ c: T[i - 1], bad: !ok })
      inp.unshift({ c: M[j - 1].c, bad: !ok })
      i--
      j--
    } else if (h === 3) {
      ans.unshift({ c: T[i - 1], bad: true })
      i--
    } else if (h === 4) {
      inp.unshift({ c: M[j - 1].c, bad: true })
      added++
      j--
    } else if (h >= 10) {
      const k = h - 10
      const seg = T.slice(i - k, i)
      ans.unshift(...seg.map((c) => ({ c })))
      inp.unshift(...seg.map((c) => ({ c }))) // 한자 대신 그 자리 소리로 보여 줘요
      i -= k
      j--
    } else break
  }
  const hit = ans.filter((c) => !c.bad).length
  const score = n ? Math.max(0, Math.round(((hit - added * 0.5) / n) * 100)) : 0
  return { target: T.join(''), mine: inp.map((c) => c.c).join(''), ans, inp, score }
}
