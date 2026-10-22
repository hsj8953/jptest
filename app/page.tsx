'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/kakitori/header'
import { Library } from '@/components/kakitori/library'
import { Study } from '@/components/kakitori/study'
import { Editor } from '@/components/kakitori/editor'
import { Timing } from '@/components/kakitori/timing'
import { Invite } from '@/components/kakitori/invite'
import { Login } from '@/components/kakitori/login'
import { MOCK_USER, useStore } from '@/lib/store'

type View = 'login' | 'library' | 'study' | 'editor' | 'timing' | 'invite'

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
  // Firebase 로그인을 붙이면 user 와 관리자 여부가 여기로 들어와요.
  const user = MOCK_USER
  const isAdmin = user.isAdmin
  const { songs } = useStore()
  const [view, setView] = useState<View>('login')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { dark, toggle } = useDarkMode()
  const selected = songs.find((s) => s.id === selectedId)

  const go = (v: View, id: string | null = selectedId) => {
    setSelectedId(id)
    setView(v)
    window.scrollTo(0, 0)
  }
  const goLibrary = () => go('library', null)

  // 고르던 곡이 삭제됐거나 없으면 목록으로
  const needsSong = view === 'study' || view === 'timing'
  const body =
    view === 'login' ? <Login onLogin={goLibrary} />
    : view === 'invite' && isAdmin ? <Invite onBack={goLibrary} />
    : view === 'editor' && isAdmin ? <Editor key={selectedId ?? 'new'} song={selected} onBack={goLibrary} onSaved={(id) => go('timing', id)} />
    : view === 'timing' && isAdmin && selected ? <Timing key={selected.id} song={selected} onBack={goLibrary} onStudy={(id) => go('study', id)} onEdit={(id) => go('editor', id)} />
    : view === 'study' && selected ? <Study key={selected.id} song={selected} user={user} onBack={goLibrary} />
    : (
      <Library
        isAdmin={isAdmin}
        onSelect={(id) => go('study', id)}
        onEdit={(id) => go('editor', id)}
        onTiming={(id) => go('timing', id)}
        onInvite={() => go('invite', null)}
        onNew={() => go('editor', null)}
      />
    )

  return (
    <div className="min-h-screen bg-background">
      {view !== 'login' && <Header user={user} dark={dark} onHome={goLibrary} onDark={toggle} onLogout={() => go('login', null)} />}
      {needsSong && !selected ? (
        <Library isAdmin={isAdmin} onSelect={(id) => go('study', id)} onEdit={(id) => go('editor', id)} onTiming={(id) => go('timing', id)} onInvite={() => go('invite', null)} onNew={() => go('editor', null)} />
      ) : body}
    </div>
  )
}
