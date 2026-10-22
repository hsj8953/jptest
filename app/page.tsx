'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { Header } from '@/components/kakitori/header'
import { Library } from '@/components/kakitori/library'
import { Study } from '@/components/kakitori/study'
import { Editor } from '@/components/kakitori/editor'
import { Timing } from '@/components/kakitori/timing'
import { Invite } from '@/components/kakitori/invite'
import { Login, NotInvited, SetupNeeded } from '@/components/kakitori/login'
import { ADMIN_EMAIL, firebaseConfigured, getFirebaseAuth, googleProvider } from '@/lib/firebase'
import { isInvited, startSync, stopSync, useStore } from '@/lib/store'
import type { User } from '@/lib/types'

type View = 'library' | 'study' | 'editor' | 'timing' | 'invite'
type AuthState = 'loading' | 'out' | 'not-invited' | 'in'

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
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const { songs } = useStore()
  const [view, setView] = useState<View>('library')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { dark, toggle } = useDarkMode()

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
      const me: User = { uid: u.uid, name: u.displayName || em.split('@')[0] || '친구', email: em, isAdmin }
      setUser(me)
      startSync(me)
      setView('library')
      setSelectedId(null)
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
    stopSync()
    signOut(getFirebaseAuth())
  }

  if (!firebaseConfigured) return <SetupNeeded />
  if (auth === 'loading') {
    return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">불러오는 중…</main>
  }
  if (auth === 'out') return <Login onLogin={login} busy={loginBusy} error={loginError} />
  if (auth === 'not-invited') return <NotInvited email={email} onLogout={logout} />
  if (!user) return null

  const isAdmin = user.isAdmin
  const selected = songs.find((s) => s.id === selectedId)
  const go = (v: View, id: string | null = selectedId) => {
    setSelectedId(id)
    setView(v)
    window.scrollTo(0, 0)
  }
  const goLibrary = () => go('library', null)
  const library = (
    <Library
      isAdmin={isAdmin}
      onSelect={(id) => go('study', id)}
      onEdit={(id) => go('editor', id)}
      onTiming={(id) => go('timing', id)}
      onInvite={() => go('invite', null)}
      onNew={() => go('editor', null)}
    />
  )

  let body = library
  if (view === 'invite' && isAdmin) body = <Invite onBack={goLibrary} />
  else if (view === 'editor' && isAdmin && (!selectedId || selected)) body = <Editor key={selectedId ?? 'new'} song={selected} onBack={goLibrary} onSaved={(id) => go('timing', id)} />
  else if (view === 'timing' && isAdmin && selected) body = <Timing key={selected.id} song={selected} onBack={goLibrary} onStudy={(id) => go('study', id)} onEdit={(id) => go('editor', id)} />
  else if (view === 'study' && selected) body = <Study key={selected.id} song={selected} user={user} onBack={goLibrary} />

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} dark={dark} onHome={goLibrary} onDark={toggle} onLogout={logout} />
      {body}
    </div>
  )
}
