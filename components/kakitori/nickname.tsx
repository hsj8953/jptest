'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NICK_MAX } from '@/lib/store'

/** 닉네임 정하기 (처음 로그인할 때, 또는 헤더에서 바꿀 때) */
export function NicknameForm({ initial, first, onSave, onCancel }: { initial: string; first: boolean; onSave: (n: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const trimmed = name.trim()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed) return setError('닉네임을 적어 주세요.')
    setBusy(true)
    setError('')
    try {
      await onSave(trimmed)
    } catch {
      setError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  return (
    <main className="app-paper grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{first ? '처음 오셨네요' : '닉네임 바꾸기'}</p>
        <h1 className="mt-2 text-2xl font-bold">닉네임을 정해 주세요</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">친구들 기록에는 구글 계정 이름 대신 이 닉네임이 보여요. 나중에 언제든 바꿀 수 있어요.</p>
        <label htmlFor="nickname" className="mt-5 block text-sm font-semibold">닉네임</label>
        <input
          id="nickname"
          autoFocus
          value={name}
          maxLength={NICK_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 하루"
          className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{trimmed.length} / {NICK_MAX}</p>
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{first ? '로그아웃' : '취소'}</Button>
          <Button type="submit" disabled={busy || !trimmed}>{busy && <Loader2 className="animate-spin" data-icon="inline-start" />}저장</Button>
        </div>
      </form>
    </main>
  )
}
