'use client'

import { useState } from 'react'
import { BookOpen, LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import type { User } from '@/lib/types'

export function Header({ user, dark, onHome, onDark, onLogout }: { user: User; dark: boolean; onHome: () => void; onDark: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const initial = user.name.slice(0, 1)
  return (
    <header className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <button onClick={onHome} className="flex items-center gap-2 rounded-lg text-left transition-opacity hover:opacity-80">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><BookOpen className="size-5" /></span>
          <span>
            <span className="block text-sm font-bold tracking-tight">카키토리 노트</span>
            <span className="font-jp text-[11px] text-muted-foreground">書き取りノート</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onDark} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{initial}</span>
            <span className="text-sm">
              {user.name} {user.isAdmin && <span className="text-xs text-primary">관리자</span>}
            </span>
            <button onClick={onLogout} className="ml-1 text-muted-foreground hover:text-foreground" aria-label="로그아웃">
              <LogOut className="size-4" />
            </button>
          </div>
          <button onClick={() => setOpen(!open)} className="grid size-9 place-items-center rounded-full hover:bg-muted sm:hidden" aria-label="메뉴" aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border px-4 py-3 sm:hidden">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{initial}</span>
              {user.name} {user.isAdmin && <span className="text-xs text-primary">관리자</span>}
            </span>
            <button onClick={() => { setOpen(false); onLogout() }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              <LogOut className="size-4" />로그아웃
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
