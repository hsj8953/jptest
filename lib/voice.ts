'use client'

// 단어장 발음: VOICEVOX로 미리 만들어 Firestore에 저장한 음성을 모두가 똑같이 들어요.
//   config/voice        { speaker, credit }   지금 쓰는 목소리 (관리자가 고름)
//   audio/{id}          { text, speaker, wav } 음성 파일 (wav를 base64로)
// 음성을 만들 때만 관리자 PC에서 VOICEVOX 프로그램이 켜져 있으면 돼요.

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getDb } from './firebase'

/** 음성 만드는 방식 버전 (관리자 화면에 표시해서 새 버전이 배포됐는지 확인용) — d = VOICEVOX 기본 설정 */
export const VOICE_RECIPE = 'd'

export const VOICEVOX_URL = 'http://localhost:50021'

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
// 가나 한두 글자는 '글자 그대로' 읽게 만들어서 이름을 따로 붙여요 (dk)
export const audioId = (speaker: number, text: string) => `${VOICE_RECIPE}${isShort(text) ? 'k' : ''}${speaker}_${fnv(clean(text))}_${Array.from(clean(text)).length}`

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
// 발음 볼륨 (0~1). 기기마다 따로 기억해요
const VOL_KEY = 'kakitori-voice-volume'
let volume = 1
try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(VOL_KEY) : null
  const v = Number(raw)
  if (raw !== null && Number.isFinite(v) && v >= 0 && v <= 1) volume = v
} catch {}
export const getVolume = () => volume
export function setVolume(v: number) {
  volume = Math.min(1, Math.max(0, v))
  try {
    localStorage.setItem(VOL_KEY, String(volume))
  } catch {}
}

let current: HTMLAudioElement | null = null
async function playWav(b64: string) {
  current?.pause()
  current = new Audio(`data:audio/wav;base64,${b64}`)
  current.volume = volume
  await current.play()
}

/** 저장된 음성이 있으면 재생하고 true, 없으면 false */
export async function playStored(text: string) {
  const c = await loadVoiceConfig()
  if (!c) return false
  const b64 = await fetchAudio(c.speaker, text)
  if (!b64) return false
  try {
    await playWav(b64)
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
  // 가나 한두 글자를 그대로 넘기면 は를 조사 'わ', へ를 'え'로 읽어요.
  // 그래서 글자 그대로 읽는 가나 표기(カタカナ + 악센트 ')로 읽는 법만 바꿔요. 나머지는 기본 설정 그대로예요.
  const kata = toKatakana(clean(text))
  if (isShort(text) && /^[\u30A1-\u30FCー]+$/.test(kata)) {
    const r = await fetch(`${VOICEVOX_URL}/accent_phrases?speaker=${speaker}&is_kana=true&text=${encodeURIComponent(kata + "'")}`, { method: 'POST' })
    if (r.ok) query.accent_phrases = await r.json()
  }
  // 파일 크기만 줄이려고 16kHz로 받아요
  query.outputSamplingRate = 16000
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
  const wav = await vvSynth(text, speaker)
  await playWav(toBase64(wav))
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
