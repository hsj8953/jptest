'use client'

import { useEffect, useMemo, useState } from 'react'
import { Ban, RotateCcw, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actions, loadAllScores, useStore, type ScoreRow } from '@/lib/store'
import { BackButton } from './furigana'

type Person = { uid: string; name: string; email: string; firstAt: number; lastAt: number; solved: number; songs: number; known: boolean }
type Tab = 'all' | 'blocked'

const DAY = 86_400_000
function ago(t: number) {
  if (!t) return '기록 없음'
  const d = Date.now() - t
  if (d < 3_600_000) return `${Math.max(1, Math.round(d / 60_000))}분 전`
  if (d < DAY) return `${Math.round(d / 3_600_000)}시간 전`
  if (d < 30 * DAY) return `${Math.round(d / DAY)}일 전`
  return new Date(t).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' })
}
const date = (t: number) => (t ? new Date(t).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : '-')

/** 관리자: 사용자 관리. 로그인한 사람은 누구나 쓸 수 있고, 여기서 차단한 사람만 막혀요 */
export function Users({ me, onBack }: { me: string; onBack: () => void }) {
  const { members, blocked, songs, ready } = useStore()
  const [rows, setRows] = useState<ScoreRow[]>([])
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const songKey = songs.map((s) => s.id).join(',')
  useEffect(() => {
    if (!ready || !songs.length) return
    loadAllScores(songs.map((s) => s.id)).then(setRows).catch(() => setRows([]))
  }, [ready, songKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // 사용자 목록 + 공부 기록. 이 기능 전에 온 친구는 다음에 로그인할 때 목록에 들어와요 (그 전엔 기록만 보여요)
  const people = useMemo(() => {
    const map = new Map<string, Person>()
    for (const m of members) map.set(m.uid, { ...m, solved: 0, songs: 0, known: true })
    for (const r of rows) {
      const p = map.get(r.uid) ?? { uid: r.uid, name: r.name, email: '', firstAt: 0, lastAt: 0, solved: 0, songs: 0, known: false }
      p.solved += r.d.easy.ok + r.d.normal.ok + r.d.hard.ok
      p.songs += 1
      if (!p.known) p.lastAt = Math.max(p.lastAt, r.at)
      if (!p.name) p.name = r.name
      map.set(r.uid, p)
    }
    return [...map.values()].sort((a, b) => b.lastAt - a.lastAt)
  }, [members, rows])

  const week = people.filter((p) => p.lastAt > Date.now() - 7 * DAY).length
  const nq = q.trim().toLowerCase()
  const list = people.filter((p) => (tab === 'blocked' ? blocked.includes(p.uid) : true) && (!nq || `${p.name} ${p.email}`.toLowerCase().includes(nq)))

  const run = (fn: Promise<void>, ok: string) => {
    setMsg('')
    fn.then(() => setMsg(ok)).catch(() => setMsg('처리하지 못했어요. 보안 규칙을 바꿨는지 확인하고 다시 시도해 주세요.'))
    setConfirm(null)
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <BackButton onClick={onBack} />
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">관리자 · 사용자 관리</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">사용자 관리</h1>
      <p className="mt-1 text-sm text-muted-foreground">구글 계정으로 로그인하면 누구나 바로 쓸 수 있어요. 문제가 있는 사람만 차단해 주세요. 차단하면 곡과 가사를 볼 수 없고, 순위표에서도 이름이 숨겨져요.</p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[['전체', `${people.length}명`], ['최근 7일 접속', `${week}명`], ['차단', `${blocked.length}명`]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">{k}</p>
            <p className="text-xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">사용자 찾기</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임이나 이메일로 찾기" className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </label>
        <div className="flex gap-2">
          {([['all', '전체'], ['blocked', `차단됨 ${blocked.length}`]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`h-9 rounded-full border px-3 text-xs font-medium transition ${tab === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40'}`}>{label}</button>
          ))}
        </div>
      </div>
      {msg && <p className="mt-3 text-sm text-muted-foreground" role="status">{msg}</p>}

      {list.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">{tab === 'blocked' && !nq ? '차단한 사람이 없어요.' : ready ? '찾는 사람이 없어요.' : '불러오는 중…'}</p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((p) => {
            const isMe = p.uid === me
            const isBlocked = blocked.includes(p.uid)
            return (
              <li key={p.uid} className={`border-t border-border px-4 py-3 first:border-t-0 ${isBlocked ? 'bg-destructive/5' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${isBlocked ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary'}`}>{(p.name || p.email || '?').slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <b className="truncate text-sm">{p.name || '(닉네임 없음)'}</b>
                      {isMe && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary"><ShieldCheck className="size-3" />관리자</span>}
                      {isBlocked && <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 text-[11px] font-bold text-destructive">차단됨</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{p.email || '이메일은 다음 로그인 때 보여요'}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {p.known ? `처음 ${date(p.firstAt)} · 마지막 접속 ${ago(p.lastAt)}` : `마지막 공부 ${ago(p.lastAt)}`}
                      {p.songs > 0 && ` · ${p.songs}곡 · 맞힌 문장 ${p.solved}`}
                    </span>
                  </span>
                  {!isMe && confirm !== p.uid && (
                    isBlocked
                      ? <Button size="sm" variant="outline" onClick={() => run(actions.unblock(p.uid), `${p.name || p.email}님의 차단을 풀었어요.`)}><RotateCcw data-icon="inline-start" />차단 풀기</Button>
                      : <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setConfirm(p.uid); setMsg('') }}><Ban data-icon="inline-start" />차단</Button>
                  )}
                </div>
                {confirm === p.uid && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm">
                    <span className="flex-1">{p.name || p.email}님을 차단할까요? 바로 사이트를 쓸 수 없게 돼요.</span>
                    <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>취소</Button>
                    <Button size="sm" variant="destructive" onClick={() => run(actions.block(p.uid), `${p.name || p.email}님을 차단했어요.`)}>차단하기</Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">이 기능을 넣기 전에 가입한 친구는 다음에 로그인할 때 이메일과 접속 기록이 채워져요.</p>
    </main>
  )
}
