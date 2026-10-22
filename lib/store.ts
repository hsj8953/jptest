'use client'

// 지금은 브라우저(localStorage)에 저장하는 임시 저장소예요.
// Firebase를 붙일 때는 이 파일의 actions 안쪽만 Firestore 읽기/쓰기로 바꾸면 화면 코드는 그대로 써요.

import { useSyncExternalStore } from 'react'
import { seedSongs } from './seed'
import type { Song, SongProgress, User } from './types'

type State = {
  songs: Song[]
  progress: Record<string, SongProgress>
  invites: string[]
}

const KEY = 'kakitori.v1'
const initial: State = { songs: seedSongs, progress: {}, invites: [] }

let state: State = initial
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) state = { ...initial, ...JSON.parse(raw) }
  } catch {
    /* 저장소를 못 쓰면 예시 데이터로 시작 */
  }
}

function set(next: State) {
  state = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 저장 실패해도 화면은 계속 동작 */
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore() {
  return useSyncExternalStore(
    subscribe,
    () => {
      load()
      return state
    },
    () => initial,
  )
}

export const actions = {
  saveSong(song: Song) {
    const exists = state.songs.some((s) => s.id === song.id)
    set({ ...state, songs: exists ? state.songs.map((s) => (s.id === song.id ? song : s)) : [song, ...state.songs] })
  },
  deleteSong(id: string) {
    const progress = { ...state.progress }
    delete progress[id]
    set({ ...state, songs: state.songs.filter((s) => s.id !== id), progress })
  },
  saveProgress(songId: string, p: SongProgress) {
    set({ ...state, progress: { ...state.progress, [songId]: p } })
  },
  setInvites(invites: string[]) {
    set({ ...state, invites })
  },
}

// 로그인 연결 전 임시 사용자 (Firebase 로그인으로 바뀔 자리)
export const MOCK_USER: User = { uid: 'local', name: '하루', email: '', isAdmin: true }

export const newSongId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export function countCorrect(p: SongProgress | undefined, total: number) {
  if (!p) return 0
  let n = 0
  for (let i = 0; i < total; i++) if (p[i]?.ok) n++
  return n
}
