'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actions, useStore } from '@/lib/store'
import { BackButton } from './furigana'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function Invite({ onBack }: { onBack: () => void }) {
  const { invites } = useStore()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const value = email.trim().toLowerCase()
  const invalid = value !== '' && !EMAIL.test(value)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL.test(value)) return setMsg('올바른 이메일 형식이 아니에요.')
    if (invites.includes(value)) return setMsg('이미 초대한 이메일이에요.')
    actions.setInvites([...invites, value])
      .then(() => { setEmail(''); setMsg(`${value} 을(를) 초대했어요.`) })
      .catch(() => setMsg('저장하지 못했어요. 다시 시도해 주세요.'))
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <BackButton onClick={onBack} />
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">관리자 · 친구 초대</p>
      <h1 className="mt-2 text-3xl font-bold">함께 공부할 친구를 초대해요</h1>
      <p className="mt-2 text-sm text-muted-foreground">여기 있는 구글 이메일로 로그인한 사람만 사이트를 쓸 수 있어요. 친구에게 주소를 보내기 전에 먼저 추가해 주세요.</p>
      <form onSubmit={add} className="mt-8 rounded-2xl border border-border bg-card p-5">
        <label htmlFor="invite-email" className="text-sm font-semibold">구글 이메일 주소</label>
        <div className="mt-2 flex gap-2">
          <input id="invite-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setMsg('') }} placeholder="friend@gmail.com" className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring" />
          <Button type="submit" className="h-11"><Send data-icon="inline-start" />추가</Button>
        </div>
        {invalid && <p className="mt-2 text-xs text-destructive">올바른 이메일 형식이 아니에요.</p>}
        {msg && !invalid && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
        <div className="mt-6 flex flex-col gap-2">
          {invites.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">아직 초대한 친구가 없어요.</p>}
          {invites.map((item) => (
            <div key={item} className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-3 text-sm">
              <span className="min-w-0 truncate">{item}</span>
              <button type="button" onClick={() => actions.setInvites(invites.filter((i) => i !== item)).catch(() => setMsg('저장하지 못했어요. 다시 시도해 주세요.'))} className="shrink-0 text-muted-foreground hover:text-destructive">빼기</button>
            </div>
          ))}
        </div>
      </form>
    </main>
  )
}
