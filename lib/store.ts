'use client'

// Firestore 저장소
//   config/access                  { emails: [...] }          초대 목록
//   songs/{songId}                 곡 정보 · 문장 · 타이밍
//   songs/{songId}/scores/{uid}    친구별 점수 (모두가 봄)
//   users/{uid}/progress/{songId}  내 진도 · 내가 쓴 답 (나만 봄)

import { useSyncExternalStore } from 'react'
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb } from './firebase'
import type { Song, SongProgress, User } from './types'

type State = {
  ready: boolean
  songs: Song[]
  progress: Record<string, SongProgress>
  invites: string[]
  error: string | null
}

const empty: State = { ready: false, songs: [], progress: {}, invites: [], error: null }
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
        snap.docs.forEach((d) => {
          progress[d.id] = (d.data().lines ?? {}) as SongProgress
        })
        set({ progress })
        progIn = true
        markReady()
      },
      () => {
        progIn = true
        markReady()
      },
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

export type Score = { uid: string; name: string; ok: number; total: number }

/** 이 곡의 친구들 점수를 실시간으로 받아요 */
export function watchScores(songId: string, cb: (scores: Score[]) => void) {
  return onSnapshot(
    collection(getDb(), 'songs', songId, 'scores'),
    (snap) => cb(snap.docs.map((d) => ({ uid: d.id, name: String(d.data().name ?? '친구'), ok: Number(d.data().ok ?? 0), total: Number(d.data().total ?? 0) }))),
    () => cb([]),
  )
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
    await setDoc(doc(getDb(), 'songs', id), body)
  },
  async deleteSong(id: string) {
    const db = getDb()
    const scores = await getDocs(collection(db, 'songs', id, 'scores'))
    await Promise.all(scores.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'songs', id))
  },
  async saveProgress(songId: string, p: SongProgress) {
    if (!me) return
    const db = getDb()
    const total = state.songs.find((s) => s.id === songId)?.lines.length ?? 0
    // 화면이 바로 바뀌도록 먼저 반영
    set({ progress: { ...state.progress, [songId]: p } })
    await setDoc(doc(db, 'users', me.uid, 'progress', songId), { lines: p, updatedAt: serverTimestamp() })
    await setDoc(doc(db, 'songs', songId, 'scores', me.uid), { name: me.name, ok: countCorrect(p, total), total, updatedAt: serverTimestamp() })
  },
  async setInvites(emails: string[]) {
    await setDoc(doc(getDb(), 'config', 'access'), { emails })
  },
}
