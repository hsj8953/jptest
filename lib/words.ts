'use client'

// 단어장: 곡 가사에서 한자가 들어간 단어를 사전형으로 뽑고, AI로 읽기·뜻을 붙여요.
import { getTokenizer, toHira } from './furigana'
import { getFirebaseAuth } from './firebase'
import { postAi, type AiError } from './ai-client'
import { KANJI, answerOf } from './ruby'
import type { Line, SongWord } from './types'

const KEEP_POS = new Set(['名詞', '動詞', '形容詞', '副詞', '連体詞'])
const SKIP_DETAIL = new Set(['数', '非自立', '接尾'])

export const wordKey = (w: Pick<SongWord, 'word' | 'reading'>) => `${w.word}|${w.reading}`

/** 가사에서 한자 단어 후보를 뽑아요 (사전형, 등장 문장 번호, 사전으로 추측한 읽기) */
export async function extractWords(lines: Line[]): Promise<SongWord[]> {
  const t = await getTokenizer()
  const map = new Map<string, SongWord>()
  lines.forEach((line, i) => {
    for (const tk of t.tokenize(answerOf(line.ruby))) {
      if (!KEEP_POS.has(tk.pos) || SKIP_DETAIL.has(tk.pos_detail_1)) continue
      const base = tk.basic_form && tk.basic_form !== '*' ? tk.basic_form : tk.surface_form
      if (!KANJI.test(base)) continue
      const got = map.get(base)
      if (got) {
        if (!got.lines.includes(i)) got.lines.push(i)
        continue
      }
      // 사전형의 읽기를 사전으로 추측 (AI가 실패했을 때 대비)
      const reading = toHira(
        t
          .tokenize(base)
          .map((x) => (x.reading && x.reading !== '*' ? x.reading : x.surface_form))
          .join(''),
      )
      map.set(base, { word: base, reading, meaning: '', lines: [i] })
    }
  })
  return [...map.values()]
}

/** AI로 읽기와 뜻을 채워요. 실패하면 사전 읽기만 남기고 이유를 알려줘요. */
export async function fillWordInfo(words: SongWord[], lines: Line[], onProgress?: (done: number, total: number, note?: string) => void) {
  const out = words.map((w) => ({ ...w }))
  let error: string | undefined
  let detail: string | undefined
  try {
    const token = await getFirebaseAuth().currentUser?.getIdToken()
    if (!token) throw Object.assign(new Error('unauthorized'), { detail: '' })
    // 작게 나눠 보내요. 실패한 묶음이 있어도 성공한 단어는 남겨요.
    const CHUNK = 10
    let done = 0
    let failed = 0
    let firstErr: { message: string; detail?: string } | null = null
    onProgress?.(0, out.length)
    const starts: number[] = []
    for (let i = 0; i < out.length; i += CHUNK) starts.push(i)
    const runOne = async (s: number) => {
      const part = out.slice(s, s + CHUNK)
      try {
        const json = await postAi<{ words: ({ word: string; reading: string; meaning: string } | null)[] }>(
          '/api/words',
          { items: part.map((w) => ({ word: w.word, context: answerOf(lines[w.lines[0]]?.ruby ?? '') })) },
          token,
          (sec) => onProgress?.(done, out.length, `Gemini가 바빠서 ${sec}초 뒤 다시 시도해요…`),
        )
        json.words.forEach((r, j) => {
          if (!r) return
          const w = out[s + j]
          if (r.reading) w.reading = r.reading
          if (r.meaning) w.meaning = r.meaning
        })
      } catch (e) {
        failed += part.length
        firstErr ??= { message: (e as AiError).code ?? (e as Error).message, detail: (e as AiError).detail }
      } finally {
        done += part.length
        onProgress?.(done, out.length)
      }
    }
    // 무료 한도에 덜 걸리게 하나씩 순서대로 보내요
    for (const st of starts) await runOne(st)
    if (firstErr) {
      const fe = firstErr as { message: string; detail?: string }
      error = fe.message
      detail = `${failed}개 실패${fe.detail ? ` · ${fe.detail}` : ''}`
    }
  } catch (e) {
    error = (e as Error).message
    detail = (e as { detail?: string }).detail
  }
  return { words: out, error, detail }
}

// ── 발음 (기기에 내장된 일본어 음성) ─────────────────
let jaVoice: SpeechSynthesisVoice | null | undefined
function pickVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  jaVoice = voices.find((v) => v.lang === 'ja-JP') ?? voices.find((v) => v.lang.startsWith('ja')) ?? null
  return jaVoice
}
export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}
export function speak(text: string, rate = 0.9) {
  if (!canSpeak()) return false
  const synth = window.speechSynthesis
  if (jaVoice === undefined) {
    pickVoice()
    synth.onvoiceschanged = () => pickVoice()
  }
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = rate
  if (jaVoice) u.voice = jaVoice
  synth.speak(u)
  return true
}
