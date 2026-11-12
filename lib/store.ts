'use client'

// Firestore 저장소
//   config/blocked                 { uids: [...] }            차단한 사람 (로그인한 사람은 누구나 쓸 수 있고, 여기 있는 사람만 막아요)
//   members/{uid}                  로그인한 사람 목록 (이메일·닉네임·처음/마지막 접속, 관리자만 봄)
//   songs/{songId}                 곡 정보 · 문장 · 타이밍
//   songs/{songId}/scores/{uid}    친구별 점수 (모두가 봄)
//   users/{uid}/progress/{songId}  내 진도 · 내가 쓴 답 (나만 봄)
//   songRequests/{유튜브ID}         곡 신청 (신청한 사람과 관리자만 봄)
//   users/{uid}/meta/profile       내 닉네임 (친구들 기록에는 이 이름이 보여요)

import { useSyncExternalStore } from 'react'
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { getDb } from './firebase'
import type { Difficulty, Song, SongProgress, User, VocabProgress } from './types'

export type SongRequest = { id: string; youtubeId: string; title: string; artist: string; requesters: { uid: string; name: string }[]; createdAt: number; status: 'pending' | 'added'; songId?: string; songTitle?: string }
const toSongRequest = (id: string, x: Record<string, unknown>): SongRequest => ({
  id,
  youtubeId: String(x.youtubeId ?? id),
  title: String(x.title ?? ''),
  artist: String(x.artist ?? ''),
  requesters: Array.isArray(x.requesters) ? (x.requesters as { uid: string; name: string }[]) : [],
  createdAt: Number(x.createdAt ?? 0),
  status: x.status === 'added' ? 'added' : 'pending',
  songId: x.songId ? String(x.songId) : undefined,
  songTitle: x.songTitle ? String(x.songTitle) : undefined,
})

export type Member = { uid: string; email: string; name: string; firstAt: number; lastAt: number }

type State = {
  ready: boolean
  songs: Song[]
  progress: Record<string, SongProgress>
  /** 곡별 마지막으로 공부한 시각 (ms) — 이어서 하기에 써요 */
  touched: Record<string, number>
  /** 차단한 사람 uid */
  blocked: string[]
  /** 로그인한 사람 목록 (관리자만) */
  members: Member[]
  /** 곡 신청: 관리자는 대기 중인 전체, 친구는 내 신청 중 추가된 것 */
  songRequests: SongRequest[]
  /** 친구: 이미 확인한 '추가됐어요' 알림 */
  seenAdded: string[]
  /** 단어장 진도 (나만 봄) */
  vocab: VocabProgress
  /** 업데이트 소식 (최근 것부터) */
  news: NewsItem[]
  error: string | null
}

const empty: State = { ready: false, songs: [], progress: {}, touched: {}, blocked: [], members: [], songRequests: [], seenAdded: [], vocab: { words: {}, kana: {} }, news: [], error: null }
export type NewsKind = 'new' | 'improve' | 'fix'
export type NewsLink = 'stamps' | 'vocab' | 'wrong' | 'help' | 'progress' | 'grammar'
/** 패치 노트 한 줄 */
export type NewsEntry = { kind: NewsKind; title: string; body?: string; link?: NewsLink | null }
/** 소식 글 하나 = 한 번의 업데이트(패치 노트). 예전 형식(글 하나에 한 줄)도 읽을 수 있게 kind/body를 남겨 둬요 */
export type NewsItem = {
  id: string
  title: string
  createdAt: number
  blog?: string | null
  items?: NewsEntry[]
  kind?: NewsKind
  body?: string
  link?: NewsLink | null
}
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
  // 업데이트 소식: 최근 30개
  unsubs.push(
    onSnapshot(
      query(collection(db, 'news'), orderBy('createdAt', 'desc')),
      (snap) => set({ news: snap.docs.slice(0, 30).map((d) => ({ id: d.id, ...(d.data() as Omit<NewsItem, 'id'>) })) }),
      () => {}, // 규칙이 아직 없으면 조용히 비워 둬요
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
        query(collection(db, 'songRequests'), where('status', '==', 'pending')),
        (snap) => set({ songRequests: snap.docs.map((d) => toSongRequest(d.id, d.data())).sort((a, b) => a.createdAt - b.createdAt) }),
        () => {},
      ),
    )
  } else {
    // 내 신청 중에 추가된 곡 → 알림
    unsubs.push(
      onSnapshot(
        // (색인을 따로 안 만들어도 되게 상태는 받아서 걸러요)
        query(collection(db, 'songRequests'), where('requesterUids', 'array-contains', user.uid)),
        (snap) => set({ songRequests: snap.docs.map((d) => toSongRequest(d.id, d.data())).filter((r) => r.status === 'added') }),
        () => {},
      ),
      onSnapshot(
        doc(db, 'users', user.uid, 'meta', 'songRequests'),
        (s) => set({ seenAdded: ((s.data()?.seen as string[] | undefined) ?? []).slice() }),
        () => {},
      ),
    )
  }
  unsubs.push(
    onSnapshot(
      doc(db, 'config', 'blocked'),
      (s) => set({ blocked: ((s.data()?.uids as string[] | undefined) ?? []).slice() }),
      () => {},
    ),
  )
  if (user.isAdmin) {
    unsubs.push(
      onSnapshot(
        collection(db, 'members'),
        (snap) =>
          set({
            members: snap.docs.map((d) => {
              const x = d.data()
              return { uid: d.id, email: String(x.email ?? ''), name: String(x.name ?? ''), firstAt: Number(x.firstAt ?? 0), lastAt: Number(x.lastAt ?? 0) }
            }),
          }),
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

/** 차단된 사람인지 확인 (확인하지 못하면 막지 않아요. 진짜 막는 건 보안 규칙이에요) */
export async function isBlocked(uid: string) {
  try {
    const s = await getDoc(doc(getDb(), 'config', 'blocked'))
    return ((s.data()?.uids as string[] | undefined) ?? []).includes(uid)
  } catch {
    return false
  }
}

/** 로그인할 때마다 사용자 목록에 나를 남겨요 (처음 온 날, 마지막 접속) */
export async function touchMember(user: User) {
  const ref = doc(getDb(), 'members', user.uid)
  const now = Date.now()
  const cur = await getDoc(ref)
  await setDoc(ref, { email: user.email, name: user.name.slice(0, 20), firstAt: cur.exists() ? Number(cur.data().firstAt ?? now) : now, lastAt: now })
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
        }).filter((sc) => !state.blocked.includes(sc.uid)), // 차단한 사람은 순위표에서 숨겨요
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

/** 저장해 둔 닉네임 (없으면 null) */
export async function loadNickname(uid: string) {
  const snap = await getDoc(doc(getDb(), 'users', uid, 'meta', 'profile'))
  const n = snap.exists() ? String(snap.data().nickname ?? '').trim() : ''
  return n || null
}

export const NICK_MAX = 12

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
  /** 닉네임 저장 + 이미 남긴 친구 기록의 이름도 바꿔요 */
  async setNickname(uid: string, nickname: string) {
    const name = nickname.trim().slice(0, NICK_MAX)
    const db = getDb()
    await setDoc(doc(db, 'users', uid, 'meta', 'profile'), { nickname: name, updatedAt: serverTimestamp() }, { merge: true })
    if (me && me.uid === uid) me = { ...me, name }
    await setDoc(doc(db, 'members', uid), { name }, { merge: true }).catch(() => {})
    const songs = await getDocs(collection(db, 'songs'))
    await Promise.all(
      songs.docs.map(async (sd) => {
        const ref = doc(db, 'songs', sd.id, 'scores', uid)
        if ((await getDoc(ref)).exists()) await setDoc(ref, { name }, { merge: true })
      }),
    )
    return name
  },
  /** 곡 신청 (친구). 같은 영상을 누가 이미 신청했으면 그 신청에 이름만 더해요 */
  async requestSong(youtubeId: string, title: string, artist: string) {
    if (!me) throw new Error('unauthorized')
    const ref = doc(getDb(), 'songRequests', youtubeId)
    const who = { uid: me.uid, name: me.name }
    let exists = true
    try {
      exists = (await getDoc(ref)).exists()
    } catch (e) {
      // 다른 친구가 이미 신청한 곡은 내용을 볼 수 없어서 '권한 없음'이 나와요 → 있는 걸로 봐요
      if ((e as { code?: string }).code !== 'permission-denied') throw e
    }
    if (!exists) {
      await setDoc(ref, { youtubeId, title: title.trim().slice(0, 80), artist: artist.trim().slice(0, 60), requesterUids: [me.uid], requesters: [who], status: 'pending', createdAt: Date.now() })
    } else {
      await updateDoc(ref, { requesterUids: arrayUnion(me.uid), requesters: arrayUnion(who) })
    }
  },
  /** 관리자: 신청한 곡을 등록했어요 → 신청한 친구들에게 알림 */
  async markSongRequestAdded(requestId: string, songId: string, songTitle: string) {
    await updateDoc(doc(getDb(), 'songRequests', requestId), { status: 'added', songId, songTitle, addedAt: Date.now() })
  },
  async deleteSongRequest(requestId: string) {
    await deleteDoc(doc(getDb(), 'songRequests', requestId))
  },
  /** 친구: '추가됐어요' 알림 닫기 */
  async dismissAdded(ids: string[]) {
    if (!me) return
    const seen = [...new Set([...state.seenAdded, ...ids])].slice(-200)
    set({ seenAdded: seen })
    await setDoc(doc(getDb(), 'users', me.uid, 'meta', 'songRequests'), { seen })
  },
  /** 관리자: 차단 / 차단 풀기 */
  async block(uid: string) {
    await setDoc(doc(getDb(), 'config', 'blocked'), { uids: arrayUnion(uid) }, { merge: true })
  },
  async unblock(uid: string) {
    await setDoc(doc(getDb(), 'config', 'blocked'), { uids: arrayRemove(uid) }, { merge: true })
  },
}

/* ── 관리자: 친구들 학습 현황 ─────────────────────────────
   songs/{id}/scores/{uid} 에 쌓인 요약(닉네임, 난이도별 맞힌 문장/전체, 마지막 시각)만 읽어요.
   친구가 적은 답 내용(users/{uid}/progress)은 읽지 않아요. */
export type ScoreRow = {
  uid: string
  name: string
  songId: string
  at: number // 마지막으로 푼 시각 (ms), 모르면 0
  d: Record<Difficulty, { ok: number; total: number }>
}
export async function loadAllScores(songIds: string[]): Promise<ScoreRow[]> {
  const db = getDb()
  const per = await Promise.all(
    songIds.map(async (songId) => {
      const snap = await getDocs(collection(db, 'songs', songId, 'scores'))
      return snap.docs.map((s) => {
        const v = s.data() as Record<string, unknown>
        const pair = (x: unknown) => {
          const o = (x ?? {}) as { ok?: number; total?: number }
          return { ok: Number(o.ok) || 0, total: Number(o.total) || 0 }
        }
        const ts = v.updatedAt as { toMillis?: () => number } | undefined
        return {
          uid: s.id,
          name: String(v.name ?? '이름 없음'),
          songId,
          at: ts?.toMillis?.() ?? 0,
          d: { easy: pair(v.easy), normal: pair(v.normal), hard: pair({ ok: v.ok, total: v.total }) },
        } satisfies ScoreRow
      })
    }),
  )
  return per.flat()
}

/* ── 업데이트 소식 (news/{id}): 멤버는 읽고, 관리자만 쓰고 지워요 ── */
export async function postNews(n: { title: string; items: NewsEntry[]; blog?: string | null; createdAt?: number }) {
  const ref = doc(collection(getDb(), 'news'))
  await setDoc(ref, {
    title: n.title.trim(),
    items: n.items.map((it) => ({ kind: it.kind, title: it.title.trim(), body: it.body?.trim() ?? '', link: it.link ?? null })),
    blog: n.blog?.trim() || null,
    createdAt: n.createdAt ?? Date.now(),
  })
}
export async function deleteNews(id: string) {
  await deleteDoc(doc(getDb(), 'news', id))
}
