'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLogo } from './logo'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// 크롬이 '설치할 수 있어요' 신호를 화면이 뜨기 전에 보낼 수도 있어서 미리 받아 둬요
let deferred: InstallEvent | null = null
const subs = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    subs.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    subs.forEach((f) => f())
  })
}

const HIDE_KEY = 'kakitori-install-hidden'
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** 곡 목록 위: 홈 화면에 앱으로 설치하기 안내 (이미 설치했거나 닫았으면 안 보여요) */
export function InstallBanner() {
  const [mode, setMode] = useState<'none' | 'prompt' | 'ios'>('none')

  useEffect(() => {
    const update = () => {
      let hidden = false
      try {
        hidden = localStorage.getItem(HIDE_KEY) === '1'
      } catch {}
      if (hidden || isStandalone()) return setMode('none')
      if (deferred) return setMode('prompt')
      setMode(isIOS() ? 'ios' : 'none')
    }
    update()
    subs.add(update)
    return () => {
      subs.delete(update)
    }
  }, [])

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, '1')
    } catch {}
    setMode('none')
  }
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') {
      deferred = null
      setMode('none')
    }
  }

  if (mode === 'none') return null
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <AppLogo className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">홈 화면에 앱으로 설치하기</p>
        {mode === 'prompt' ? (
          <p className="text-xs text-muted-foreground">아이콘을 눌러 바로 켜고, 주소창 없이 넓게 쓸 수 있어요.</p>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground">
            사파리 아래쪽 <Share className="inline size-3.5 align-[-2px]" /> 공유 버튼 → <b>홈 화면에 추가</b>를 눌러 주세요.
          </p>
        )}
      </div>
      {mode === 'prompt' && (
        <Button size="sm" onClick={install}>
          <Download data-icon="inline-start" />설치
        </Button>
      )}
      <button onClick={hide} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="설치 안내 닫기">
        <X className="size-4" />
      </button>
    </div>
  )
}
