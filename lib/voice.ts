'use client'

// 단어장 발음: VOICEVOX로 미리 만들어 Firestore에 저장한 음성을 모두가 똑같이 들어요.
//   config/voice        { speaker, credit }   지금 쓰는 목소리 (관리자가 고름)
//   audio/{id}          { text, speaker, wav } 음성 파일 (wav를 base64로)
// 음성을 만들 때만 관리자 PC에서 VOICEVOX 프로그램이 켜져 있으면 돼요.

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getDb } from './firebase'

export const VOICEVOX_URL = 'http://localhost:50021'
/** 음성 속도 (1 = 보통) */
const SPEED = 0.9

export type VoiceConfig = { speaker: number; credit: string }

let configPromise: Promise<VoiceConfig | null> | null = null
export function loadVoiceConfig(force = false) {
  if (!configPromise || force) {
    configPromise = getDoc(doc(getDb(), 'config', 'voice'))
      .then((s) => (s.exists() && typeof s.data().speaker === 'number' ? { speaker: s.data().speaker as number, credit: String(s.data().credit ?? '') } : null))
      .catch(() => null)
  }
  return configPromise
}
export async function saveVoiceConfig(c: VoiceConfig) {
  await setDoc(doc(getDb(), 'config', 'voice'), { ...c, updatedAt: serverTimestamp() })
  configPromise = Promise.resolve(c)
}

function fnv(s: string) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0
  return h.toString(36)
}
const clean = (t: string) => t.trim()
const toKatakana = (t: string) => t.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
const isShort = (t: string) => Array.from(clean(t)).length <= 2
// 한두 글자(가나 표)는 읽는 방식을 바꿔서 새 이름으로 저장해요 (k3 = 세 번째 방식)
export const audioId = (speaker: number, text: string) => `${isShort(text) ? 'k3' : 'v'}${speaker}_${fnv(clean(text))}_${Array.from(clean(text)).length}`

// 한 번 받은 음성(또는 없다는 사실)은 기억해 둬요
const cache = new Map<string, string | null>()

async function fetchAudio(speaker: number, text: string) {
  const id = audioId(speaker, text)
  if (cache.has(id)) return cache.get(id)!
  try {
    const s = await getDoc(doc(getDb(), 'audio', id))
    const url = s.exists() && s.data().text === clean(text) ? String(s.data().wav) : null
    cache.set(id, url)
    return url
  } catch {
    return null
  }
}

// ── 재생 ──────────────────────────────────────
// 블루투스 헤드셋은 소리가 없으면 잠들었다가 깨는 데 0.2~0.3초가 걸려서, 짧은 소리(가나 한 글자)를 통째로 먹어요.
// 그래서 처음 재생할 때부터 들리지 않는 아주 작은 소리를 계속 흘려 헤드셋을 깨워 둬요.
let ctx: AudioContext | null = null
function audioCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 30
    gain.gain.value = 0.0005 // 사람 귀에는 안 들리는 크기
    osc.connect(gain).connect(ctx.destination)
    osc.start()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}
/** 단어장 화면에 들어오거나 처음 누를 때 미리 헤드셋을 깨워요 */
export function warmUpAudio() {
  audioCtx()
}

const decoded = new Map<string, AudioBuffer>()
let current: AudioBufferSourceNode | null = null
const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

async function playWav(key: string, b64: string) {
  const c = audioCtx()
  if (!c) {
    // Web Audio를 못 쓰는 브라우저
    await new Audio(`data:audio/wav;base64,${b64}`).play()
    return
  }
  let buf = decoded.get(key)
  if (!buf) {
    buf = await c.decodeAudioData(b64ToBytes(b64).buffer as ArrayBuffer)
    decoded.set(key, buf)
  }
  try {
    current?.stop()
  } catch {}
  const src = c.createBufferSource()
  src.buffer = buf
  src.connect(c.destination)
  // 헤드셋이 막 깨어난 경우를 대비해 아주 살짝 늦게 시작해요
  // (켠 지 얼마 안 됐으면 헤드셋이 깨어날 시간을 더 줘요)
  src.start(c.currentTime + (c.state !== 'running' || c.currentTime < 0.6 ? 0.4 : 0.03))
  current = src
}

/** 저장된 음성이 있으면 재생하고 true, 없으면 false */
export async function playStored(text: string) {
  audioCtx()
  const c = await loadVoiceConfig()
  if (!c) return false
  const b64 = await fetchAudio(c.speaker, text)
  if (!b64) return false
  try {
    await playWav(audioId(c.speaker, text), b64)
    return true
  } catch {
    return false
  }
}

/* ── 관리자용: VOICEVOX로 만들기 ─────────────────── */

export type VvSpeaker = { name: string; styles: { name: string; id: number }[] }

export async function vvSpeakers(): Promise<VvSpeaker[]> {
  const r = await fetch(`${VOICEVOX_URL}/speakers`)
  if (!r.ok) throw new Error(`VOICEVOX ${r.status}`)
  return r.json()
}

export async function vvSynth(text: string, speaker: number) {
  const q = await fetch(`${VOICEVOX_URL}/audio_query?speaker=${speaker}&text=${encodeURIComponent(clean(text))}`, { method: 'POST' })
  if (!q.ok) throw new Error(`audio_query ${q.status}`)
  const query = await q.json()
  // 가나 한두 글자를 문장으로 읽게 하면 は를 조사 'わ', へ를 'え'로 읽고, あ·う 같은 건 감탄사처럼 작게 읽어요.
  // 그래서 '글자 그대로' 읽는 가나 표기(AquesTalk 표기: カタカナ + 악센트 ')로 다시 만들어요.
  const kata = toKatakana(clean(text))
  if (isShort(text) && /^[\u30A1-\u30FCー]+$/.test(kata)) {
    const r = await fetch(`${VOICEVOX_URL}/accent_phrases?speaker=${speaker}&is_kana=true&text=${encodeURIComponent(kata + "'")}`, { method: 'POST' })
    if (r.ok) query.accent_phrases = await r.json()
  }
  // 파일을 작게: 16kHz. 재생 시작할 때 앞이 잘리지 않게 앞뒤에 무음을 조금 둬요
  Object.assign(query, { speedScale: SPEED, outputSamplingRate: 16000, prePhonemeLength: 0.15, postPhonemeLength: 0.2 })
  if (isShort(text)) {
    // 한두 글자는 너무 짧고, し·す처럼 모음이 소리 없이(무성화) 끝나서 끊겨 들려요.
    // 모음을 소리 내게 바꾸고, 천천히·길게 읽어요.
    type Mora = { vowel: string; vowel_length: number; consonant_length?: number | null }
    for (const ap of query.accent_phrases ?? []) {
      for (const m of ap.moras as Mora[]) {
        if (/^[AIUEO]$/.test(m.vowel)) m.vowel = m.vowel.toLowerCase()
        if (m.vowel !== 'cl') m.vowel_length = Math.max(m.vowel_length, 0.28)
      }
    }
    Object.assign(query, { speedScale: 0.8, postPhonemeLength: 0.3, volumeScale: 1.4 })
  }
  const s = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${speaker}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) })
  if (!s.ok) throw new Error(`synthesis ${s.status}`)
  return new Uint8Array(await s.arrayBuffer())
}

function toBase64(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)))
  return btoa(bin)
}

/** 미리 들어보기 (저장 안 함) */
export async function vvPreview(text: string, speaker: number) {
  audioCtx()
  const wav = await vvSynth(text, speaker)
  await playWav(`preview:${speaker}:${text}:${Date.now()}`, toBase64(wav))
}

/** 아직 없는 음성만 만들어 저장해요 */
export async function generateAudio(texts: string[], speaker: number, onProgress: (done: number, total: number, made: number) => void) {
  const list = [...new Set(texts.map(clean).filter(Boolean))]
  let made = 0
  for (let i = 0; i < list.length; i++) {
    const text = list[i]
    const id = audioId(speaker, text)
    const ref = doc(getDb(), 'audio', id)
    if (!(await getDoc(ref)).exists()) {
      const wav = await vvSynth(text, speaker)
      const b64 = toBase64(wav)
      await setDoc(ref, { text, speaker, wav: b64, createdAt: serverTimestamp() })
      cache.set(id, b64)
      made++
    }
    onProgress(i + 1, list.length, made)
  }
  return { total: list.length, made }
}

/** VOICEVOX가 켜져 있는지 빠르게 확인 (꺼져 있으면 1.5초 안에 false) */
export async function vvAvailable() {
  try {
    const r = await fetch(`${VOICEVOX_URL}/version`, { signal: AbortSignal.timeout(1500) })
    return r.ok
  } catch {
    return false
  }
}
