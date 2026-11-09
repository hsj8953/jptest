'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { Header } from '@/components/kakitori/header'
import { Library } from '@/components/kakitori/library'
import { Study } from '@/components/kakitori/study'
import { Editor } from '@/components/kakitori/editor'
import { Timing } from '@/components/kakitori/timing'
import { Invite } from '@/components/kakitori/invite'
import { Vocab } from '@/components/kakitori/vocab'
import { Login, NotInvited, SetupNeeded } from '@/components/kakitori/login'
import { ADMIN_EMAIL, firebaseConfigured, getFirebaseAuth, googleProvider } from '@/lib/firebase'
import { actions, isInvited, loadNickname, startSync, stopSync, useStore, type SongRequest } from '@/lib/store'
import { NicknameForm } from '@/components/kakitori/nickname'
import { Tutorial, shouldShowTutorial } from '@/components/kakitori/tutorial'
import { CompletionWatcher, StampBook } from '@/components/kakitori/stamps'
import { AdminProgress } from '@/components/kakitori/admin-progress'
import { NewsModal } from '@/components/kakitori/news'
import type { Difficulty, User } from '@/lib/types'
import { DifficultyPicker } from '@/components/kakitori/difficulty-picker'
import { WrongNote } from '@/components/kakitori/wrong-note'
import { wrongItems } from '@/lib/wrong'

type View = 'library' | 'study' | 'editor' | 'timing' | 'invite' | 'vocab' | 'wrong' | 'progress'
type AuthState = 'loading' | 'out' | 'not-invited' | 'in'
type Route = { view: View; id: string | null; line?: number | null; d?: Difficulty | null; w?: boolean }
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard']

// 화면 위치를 주소(?v=study&song=곡ID)에 기록해서 새로고침 · 뒤로가기 · 링크 공유가 되게 해요
const VIEWS: View[] = ['library', 'study', 'editor', 'timing', 'invite', 'vocab', 'wrong', 'progress']
function readRoute(): Route {
  const p = new URLSearchParams(window.location.search)
  const v = p.get('v') as View | null
  const line = p.get('line')
  const d = p.get('d') as Difficulty | null
  return { view: v && VIEWS.includes(v) ? v : 'library', id: p.get('song'), line: line != null && /^\d+$/.test(line) ? Number(line) : null, d: d && DIFFS.includes(d) ? d : null, w: p.get('w') === '1' }
}
function routeUrl(r: Route) {
  if (r.view === 'library') return window.location.pathname
  const p = new URLSearchParams({ v: r.view })
  if (r.id) p.set('song', r.id)
  if (r.line != null) p.set('line', String(r.line))
  if (r.d) p.set('d', r.d)
  if (r.w) p.set('w', '1')
  return `${window.location.pathname}?${p.toString()}`
}

function useDarkMode() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    let initial = window.matchMedia('(prefers-color-scheme: dark)').matches
    try {
      const saved = window.localStorage.getItem('kakitori.theme')
      if (saved) initial = saved === 'dark'
    } catch {
      /* 무시 */
    }
    setDark(initial)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    // 기기가 다크 모드여도 사이트에서 라이트를 고르면 라이트 색을 쓰도록 (globals.css의 :root:not(.light))
    document.documentElement.classList.toggle('light', !dark)
  }, [dark])
  const toggle = () => {
    setDark((d) => {
      try {
        window.localStorage.setItem('kakitori.theme', d ? 'light' : 'dark')
      } catch {
        /* 무시 */
      }
      return !d
    })
  }
  return { dark, toggle }
}

export default function Page() {
  const [auth, setAuth] = useState<AuthState>('loading')
  const [nickOpen, setNickOpen] = useState(false)
  const [tutOpen, setTutOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [newsOpen, setNewsOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const { songs, ready, progress } = useStore()
  const [view, setView] = useState<View>('library')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [line, setLine] = useState<number | null>(null)
  const [diff, setDiff] = useState<Difficulty | null>(null)
  const [wrongQueue, setWrongQueue] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<SongRequest | null>(null)
  const { dark, toggle } = useDarkMode()

  useEffect(() => {
    const apply = () => {
      const r = readRoute()
      setView(r.view)
      setSelectedId(r.id)
      setLine(r.line ?? null)
      setDiff(r.d ?? null)
      setWrongQueue(!!r.w)
    }
    apply()
    const onPop = () => {
      apply()
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // 주소에 있는 곡이 삭제됐으면 목록으로
  useEffect(() => {
    if (ready && selectedId && !songs.some((s) => s.id === selectedId)) {
      window.history.replaceState(null, '', routeUrl({ view: 'library', id: null }))
      setView('library')
      setSelectedId(null)
    }
  }, [ready, songs, selectedId])

  useEffect(() => {
    if (!firebaseConfigured) return
    return onAuthStateChanged(getFirebaseAuth(), async (u) => {
      if (!u) {
        stopSync()
        setUser(null)
        setAuth('out')
        return
      }
      setAuth('loading')
      const em = (u.email ?? '').toLowerCase()
      setEmail(em)
      const isAdmin = !!ADMIN_EMAIL && em === ADMIN_EMAIL
      let allowed = isAdmin
      if (!allowed) {
        try {
          allowed = await isInvited(em)
        } catch {
          allowed = false
        }
      }
      if (!allowed) {
        stopSync()
        setUser(null)
        setAuth('not-invited')
        return
      }
      // 친구들 기록에는 구글 이름 대신 직접 정한 닉네임이 보여요
      let nick: string | null = null
      try {
        nick = await loadNickname(u.uid)
      } catch {
        nick = null
      }
      const me: User = { uid: u.uid, name: nick ?? '', email: em, isAdmin }
      setUser(me)
      setNickOpen(!nick)
      if (nick) startSync(me)
      setAuth('in')
    })
  }, [])

  const login = async () => {
    setLoginBusy(true)
    setLoginError('')
    try {
      await signInWithPopup(getFirebaseAuth(), googleProvider())
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setLoginError(code === 'auth/popup-blocked' ? '로그인 창이 차단됐어요. 브라우저에서 팝업을 허용해 주세요.' : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      setLoginBusy(false)
    }
  }
  const logout = () => {
    window.history.replaceState(null, '', routeUrl({ view: 'library', id: null }))
    setView('library')
    setSelectedId(null)
    stopSync()
    signOut(getFirebaseAuth())
  }

  if (!firebaseConfigured) return <SetupNeeded />
  // 처음 들어온 사람: 닉네임까지 정하고 곡 목록에 오면 사용법 안내를 한 번 보여 줘요
  useEffect(() => {
    if (auth === 'in' && user?.name && !nickOpen && view === 'library' && shouldShowTutorial()) setTutOpen(true)
  }, [auth, user?.name, nickOpen, view])

  if (auth === 'loading') {
    return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">불러오는 중…</main>
  }
  if (auth === 'out') return <Login onLogin={login} busy={loginBusy} error={loginError} />
  if (auth === 'not-invited') return <NotInvited email={email} uid={getFirebaseAuth().currentUser?.uid ?? ''} onLogout={logout} onApproved={() => window.location.reload()} />
  if (!user) return null
  if (nickOpen) {
    const first = !user.name
    return (
      <NicknameForm
        initial={user.name}
        first={first}
        onCancel={first ? logout : () => setNickOpen(false)}
        onSave={async (n) => {
          const name = await actions.setNickname(user.uid, n)
          const next = { ...user, name }
          setUser(next)
          if (first) startSync(next)
          setNickOpen(false)
        }}
      />
    )
  }

  const isAdmin = user.isAdmin
  const selected = songs.find((s) => s.id === selectedId)
  const go = (v: View, id: string | null = selectedId, ln: number | null = null, d: Difficulty | null = null, w = false) => {
    const url = routeUrl({ view: v, id, line: ln, d, w })
    setWrongQueue(w)
    if (url !== window.location.pathname + window.location.search) window.history.pushState(null, '', url)
    setSelectedId(id)
    setLine(ln)
    setDiff(d)
    setView(v)
    window.scrollTo(0, 0)
  }
  const goLibrary = () => go('library', null)
  // 오답 노트 '연달아 풀기': 지금 문장을 빼고 다음 오답으로 (없으면 노트로)
  const nextWrong = () => {
    const all = wrongItems(songs, progress, isAdmin)
    const order = [...songs].sort((a, b) => b.createdAt - a.createdAt).map((x) => x.id)
    const DI: Record<string, number> = { easy: 0, normal: 1, hard: 2 }
    const key = (id: string, ln: number, d: string) => [order.indexOf(id), ln, DI[d] ?? 0]
    const cur = key(selectedId ?? '', line ?? 0, diff ?? 'hard')
    const after = (k: number[]) => k[0] > cur[0] || (k[0] === cur[0] && (k[1] > cur[1] || (k[1] === cur[1] && k[2] > cur[2])))
    const rest = all.filter((x) => !(x.song.id === selectedId && x.line === line && x.d === diff))
    // 지금 문장 다음 것부터, 끝까지 가면 처음으로 돌아가요
    const n = rest.find((x) => after(key(x.song.id, x.line, x.d))) ?? rest[0]
    if (n) go('study', n.song.id, n.line, n.d, true)
    else go('wrong', null)
  }
  const library = (
    <Library
      isAdmin={isAdmin}
      onSelect={(id, d) => go('study', id, null, d ?? null)}
      onEdit={(id) => go('editor', id)}
      onTiming={(id) => go('timing', id)}
      onInvite={() => go('invite', null)}
      onNew={() => { setPendingRequest(null); go('editor', null) }}
      onVocab={() => go('vocab', null)}
      onWrong={() => go('wrong', null)}
      onProgress={() => go('progress', null)}
      onNews={() => setNewsOpen(true)}
      onHelp={() => setTutOpen(true)}
      onStampBook={() => setBookOpen(true)}
      onRegisterRequest={(r) => { setPendingRequest(r); go('editor', null) }}
    />
  )

  let body = library
  const needsSong = view === 'study' || view === 'timing' || (view === 'editor' && !!selectedId)
  if (needsSong && !ready) body = <main className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">불러오는 중…</main>
  else if (view === 'invite' && isAdmin) body = <Invite onBack={goLibrary} />
  else if (view === 'progress' && isAdmin) body = <AdminProgress onBack={goLibrary} onOpenSong={(id) => go('study', id)} />
  else if (view === 'wrong') body = <WrongNote isAdmin={isAdmin} onBack={goLibrary} onOpen={(it, q) => go('study', it.song.id, it.line, it.d, q)} />
  else if (view === 'vocab') body = <Vocab isAdmin={isAdmin} onBack={goLibrary} onGoLine={(id, ln) => go('study', id, ln)} />
  else if (view === 'editor' && isAdmin && (!selectedId || selected)) body = <Editor key={selectedId ?? `new-${pendingRequest?.id ?? ''}`} song={selected} request={selectedId ? null : pendingRequest} onBack={() => { setPendingRequest(null); goLibrary() }} onSaved={(id) => { setPendingRequest(null); go('timing', id) }} />
  else if (view === 'timing' && isAdmin && selected) body = <Timing key={selected.id} song={selected} onBack={goLibrary} onStudy={(id) => go('study', id)} onEdit={(id) => go('editor', id)} />
  else if (view === 'study' && selected && !diff)
    body = <DifficultyPicker song={selected} onBack={goLibrary} onPick={(d) => go('study', selected.id, line, d)} />
  else if (view === 'study' && selected && diff)
    body = (
      <Study
        key={`${selected.id}-${diff}-${line ?? ''}-${wrongQueue ? 'w' : ''}`}
        song={selected}
        user={user}
        difficulty={diff}
        initialLine={line}
        onBack={wrongQueue ? () => go('wrong', null) : goLibrary}
        onChangeDifficulty={() => go('study', selected.id, null, null)}
        onNextWrong={wrongQueue ? nextWrong : undefined}
      />
    )

  return (
    <div className="app-paper min-h-screen">
      <Header user={user} dark={dark} onHome={goLibrary} onDark={toggle} onLogout={logout} onNickname={() => setNickOpen(true)} onNews={() => setNewsOpen(true)} />
      {body}
      {tutOpen && <Tutorial onClose={() => setTutOpen(false)} />}
      {newsOpen && (
        <NewsModal
          isAdmin={isAdmin}
          onClose={() => setNewsOpen(false)}
          onLink={(l) => {
            setNewsOpen(false)
            if (l === 'stamps') setBookOpen(true)
            else if (l === 'help') setTutOpen(true)
            else go(l, null)
          }}
        />
      )}
      {view === 'study' && selected && diff && (
        <CompletionWatcher key={`${selected.id}-${diff}`} song={selected} d={diff} onNext={(d) => go('study', selected.id, null, d)} onBook={() => setBookOpen(true)} />
      )}
      {bookOpen && <StampBook isAdmin={isAdmin} onClose={() => setBookOpen(false)} onOpen={(id) => { setBookOpen(false); go('study', id) }} />}
    </div>
  )
}
