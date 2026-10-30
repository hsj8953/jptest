'use client'

// Firestore 저장소
//   config/access                  { emails: [...] }          초대 목록
//   songs/{songId}                 곡 정보 · 문장 · 타이밍
//   songs/{songId}/scores/{uid}    친구별 점수 (모두가 봄)
//   users/{uid}/progress/{songId}  내 진도 · 내가 쓴 답 (나만 봄)

import { useSyncExternalStore } from 'react'
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb } from './firebase'
import type { Difficulty, Song, SongProgress, User, VocabProgress } from './types'

type State = {
  ready: boolean
  songs: Song[]
  progress: Record<string, SongProgress>
  /** 곡별 마지막으로 공부한 시각 (ms) — 이어서 하기에 써요 */
  touched: Record<string, number>
  invites: string[]
  /** 단어장 진도 (나만 봄) */
  vocab: VocabProgress
  error: string | null
}

const empty: State = { ready: false, songs: [], progress: {}, touched: {}, invites: [], vocab: { words: {}, kana: {} }, error: null }
let state: State = empty
let me: User | null = null
let unsubs: (() => void)[] = []
const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => state, () => empty)
}

/** 로그인한 뒤 실시간 동기화를 시작해요 */
export function startSync(user: User) {
  stopSync()
  me = user
  const db = getDb()
  let songsIn = false
  let progIn = false
  const markReady = () => {
    if (songsIn && progIn) set({ ready: true })
  }

  unsubs.push(
    onSnapshot(
      query(collection(db, 'songs'), orderBy('createdAt', 'desc')),
      (snap) => {
        set({ songs: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Song, 'id'>) })) })
        songsIn = true
        markReady()
      },
      () => {
        set({ error: '곡 목록을 불러오지 못했어요. 새로고침해 주세요.' })
        songsIn = true
        markReady()
      },
    ),
  )
  unsubs.push(
    onSnapshot(
      collection(db, 'users', user.uid, 'progress'),
      (snap) => {
        const progress: Record<string, SongProgress> = {}
        const touched: Record<string, number> = {}
        snap.docs.forEach((d) => {
          const data = d.data()
          progress[d.id] = (data.lines ?? {}) as SongProgress
          touched[d.id] = Number(data.touchedAt ?? data.updatedAt?.toMillis?.() ?? 0)
        })
        set({ progress, touched })
        progIn = true
        markReady()
      },
      () => {
        progIn = true
        markReady()
      },
    ),
  )
  unsubs.push(
    onSnapshot(
      doc(db, 'users', user.uid, 'meta', 'vocab'),
      (snap) => {
        const d = snap.data() ?? {}
        set({ vocab: { words: { ...(d.words ?? {}) }, kana: { ...(d.kana ?? {}) } } })
      },
      () => {},
    ),
  )
  if (user.isAdmin) {
    unsubs.push(
      onSnapshot(
        doc(db, 'config', 'access'),
        (s) => set({ invites: ((s.data()?.emails as string[] | undefined) ?? []).slice() }),
        () => {},
      ),
    )
  }
}

export function stopSync() {
  unsubs.forEach((u) => u())
  unsubs = []
  me = null
  set(empty)
}

/** 초대 목록에 있는 이메일인지 확인 */
export async function isInvited(email: string) {
  const s = await getDoc(doc(getDb(), 'config', 'access'))
  const emails = ((s.data()?.emails as string[] | undefined) ?? []).map((e) => e.toLowerCase())
  return emails.includes(email.toLowerCase())
}

type Pair = { ok: number; total: number }
/** 친구 점수: ok·total 은 어려움, easy·normal 은 해당 난이도 */
export type Score = { uid: string; name: string; ok: number; total: number; easy?: Pair; normal?: Pair }

/** 진도 문서 이름: 어려움은 곡 ID 그대로(예전 기록과 호환), 쉬움·보통은 뒤에 붙여요 */
export const progKey = (songId: string, d: Difficulty) => (d === 'hard' ? songId : `${songId}__${d}`)
export function parseProgKey(key: string): { songId: string; d: Difficulty } {
  const m = key.match(/^(.*)__(easy|normal)$/)
  return m ? { songId: m[1], d: m[2] as Difficulty } : { songId: key, d: 'hard' }
}
/** 점수 문서에서 난이도별 점수 꺼내기 */
export function scoreFor(sc: Score, d: Difficulty): Pair | null {
  if (d === 'hard') return sc.total ? { ok: sc.ok, total: sc.total } : null
  return sc[d] ?? null
}

/** 이 곡의 친구들 점수를 실시간으로 받아요 */
export function watchScores(songId: string, cb: (scores: Score[]) => void) {
  return onSnapshot(
    collection(getDb(), 'songs', songId, 'scores'),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const x = d.data()
          const pair = (v: unknown): Pair | undefined => (v && typeof v === 'object' ? { ok: Number((v as Pair).ok ?? 0), total: Number((v as Pair).total ?? 0) } : undefined)
          return { uid: d.id, name: String(x.name ?? '친구'), ok: Number(x.ok ?? 0), total: Number(x.total ?? 0), easy: pair(x.easy), normal: pair(x.normal) }
        }),
      ),
    () => cb([]),
  )
}

/** 지정한 문장들 중 맞힌 개수 */
export function countCorrectIn(p: SongProgress | undefined, lines: number[]) {
  if (!p) return 0
  return lines.filter((i) => p[i]?.ok).length
}

export function countCorrect(p: SongProgress | undefined, total: number) {
  if (!p) return 0
  let n = 0
  for (let i = 0; i < total; i++) if (p[i]?.ok) n++
  return n
}

export const newSongId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const actions = {
  async saveSong(song: Song) {
    const { id, ...body } = song
    // 확인이 끝난 줄은 check 필드를 지워서 저장
    body.lines = body.lines.map(({ check, ...l }) => (check?.length ? { ...l, check } : l))
    await setDoc(doc(getDb(), 'songs', id), body)
  },
  async deleteSong(id: string) {
    const db = getDb()
    const scores = await getDocs(collection(db, 'songs', id, 'scores'))
    await Promise.all(scores.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'songs', id))
  },
  /** 진도 저장. graded 는 이 난이도에서 채점하는 문장 번호들 */
  async saveProgress(songId: string, p: SongProgress, d: Difficulty = 'hard', graded?: number[]) {
    if (!me) return
    const db = getDb()
    const key = progKey(songId, d)
    const lines = graded ?? Array.from({ length: state.songs.find((s) => s.id === songId)?.lines.length ?? 0 }, (_, i) => i)
    const ok = lines.filter((i) => p[i]?.ok).length
    const total = lines.length
    // 화면이 바로 바뀌도록 먼저 반영
    const now = Date.now()
    set({ progress: { ...state.progress, [key]: p }, touched: { ...state.touched, [key]: now } })
    await setDoc(doc(db, 'users', me.uid, 'progress', key), { lines: p, touchedAt: now, updatedAt: serverTimestamp() })
    const score = d === 'hard' ? { ok, total } : { [d]: { ok, total } }
    await setDoc(doc(db, 'songs', songId, 'scores', me.uid), { name: me.name, ...score, updatedAt: serverTimestamp() }, { merge: true })
  },
  /** 단어장 진도 저장. 바뀐 항목만 넘기면 돼요. 예: { words: { '夜空|よぞら': 2 } } */
  async saveVocab(patch: Partial<VocabProgress>) {
    if (!me) return
    set({ vocab: { words: { ...state.vocab.words, ...(patch.words ?? {}) }, kana: { ...state.vocab.kana, ...(patch.kana ?? {}) } } })
    await setDoc(doc(getDb(), 'users', me.uid, 'meta', 'vocab'), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
  },
  async setInvites(emails: string[]) {
    await setDoc(doc(getDb(), 'config', 'access'), { emails })
  },
}
