'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Check, PartyPopper, Repeat2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { REVIEW_DAYS, REVIEW_MAX, dayLabel, doneToday, loadSession, reviewPlan, sessionResult, upcomingByDay } from '@/lib/review'
import { isWrong } from '@/lib/wrong'
import { progKey } from '@/lib/store'
import { ProgressBar } from './furigana'

/** 곡 목록 맨 위: 오늘 복습할 문장이 있으면 크게, 다 끝냈으면 한 줄로 */
export function ReviewCard({ isAdmin, onStart }: { isAdmin: boolean; onStart: () => void }) {
  const { songs, progress, ready } = useStore()
  const plan = useMemo(() => reviewPlan(songs, progress, isAdmin), [songs, progress, isAdmin])
  const [finished, setFinished] = useState(false)
  useEffect(() => setFinished(doneToday()), [])
  if (!ready) return null

  const n = plan.due.length
  if (n === 0) {
    if (!finished) return null
    const next = upcomingByDay(plan)[0]
    return (
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
        <CalendarCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="flex-1"><b>오늘 복습 끝!</b>{next && <span className="text-muted-foreground"> 다음 복습은 {dayLabel(next.day)} {next.n}문장이에요.</span>}</span>
      </div>
    )
  }

  const take = Math.min(n, REVIEW_MAX)
  const wrong = plan.due.slice(0, take).filter((it) => isWrong(progress[progKey(it.song.id, it.d)]?.[it.line])).length
  const minutes = Math.max(1, Math.round(take * 0.7))
  const songsIn = new Set(plan.due.slice(0, take).map((it) => it.song.id)).size
  return (
    <section className="mb-6 flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-[#2f3a56] to-[#4a4677] p-5 text-[#f4efe4] shadow-lg sm:flex-row sm:items-center sm:p-6">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-amber-300"><Repeat2 className="size-4" />오늘의 복습</p>
        <p className="mt-1 text-2xl font-bold">{take}문장 · 약 {minutes}분</p>
        <p className="mt-1 text-sm text-white/70">{songsIn}곡에서 잊어버릴 때가 된 문장이에요{n > take ? ` (전체 ${n}문장 중 ${take}문장씩)` : ''}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {wrong > 0 && <span className="rounded-md bg-white/15 px-2 py-0.5">오답 {wrong}</span>}
          {take - wrong > 0 && <span className="rounded-md bg-white/15 px-2 py-0.5">복습 {take - wrong}</span>}
        </div>
      </div>
      <Button onClick={onStart} className="h-12 shrink-0 rounded-xl bg-amber-400 px-7 text-base font-bold text-slate-900 hover:bg-amber-300">시작</Button>
    </section>
  )
}

/** 복습 중: 문장 위에 진행 막대 */
export function ReviewBar({ pos, total, onQuit }: { pos: number; total: number; onQuit: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <Repeat2 className="size-4 shrink-0 text-primary" />
        <b className="text-sm">오늘의 복습</b>
        <span className="text-sm tabular-nums text-muted-foreground">{pos} / {total}</span>
        <div className="mx-2 hidden flex-1 sm:block"><ProgressBar value={(pos / total) * 100} /></div>
        <button onClick={onQuit} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:ml-0"><X className="size-3.5" />그만하기</button>
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">맞히면 다음 복습까지 간격이 {REVIEW_DAYS.join('일 → ')}일로 늘어나요. 틀리면 내일 다시 나와요.</p>
    </div>
  )
}

/** 복습을 다 끝낸 화면 */
export function ReviewDone({ isAdmin, onBack, onMore }: { isAdmin: boolean; onBack: () => void; onMore: () => void }) {
  const { songs, progress, ready } = useStore()
  const [sess] = useState(() => loadSession())
  const plan = useMemo(() => reviewPlan(songs, progress, isAdmin), [songs, progress, isAdmin])
  const res = useMemo(() => (sess ? sessionResult(sess, songs, progress) : null), [sess, songs, progress])
  const days = upcomingByDay(plan).slice(0, 4)
  if (!ready) return <main className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">불러오는 중…</main>
  const solved = res ? res.remembered + res.again : 0

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="rounded-3xl border border-border bg-card p-6 text-center">
        <PartyPopper className="mx-auto size-10 text-amber-500" />
        <h1 className="mt-3 text-2xl font-bold">오늘 복습 끝!</h1>
        {res && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {solved}문장 중 {res.remembered}문장을 기억하고 있었어요.
            {res.again > 0 && <><br />틀린 {res.again}문장은 내일 다시 나와요.</>}
            {res.skipped > 0 && <><br />건너뛴 {res.skipped}문장은 다음에 다시 나와요.</>}
          </p>
        )}
        {res && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Num n={res.remembered} label="기억함" />
            <Num n={res.again} label="다시 복습" />
            <Num n={res.mastered} label="새로 외움" />
          </div>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold">앞으로의 복습</h2>
        <ul className="mt-2 divide-y divide-border text-sm">
          {plan.due.length > 0 && <Row label="지금" value={`${plan.due.length}문장`} />}
          {days.map((x) => <Row key={x.day} label={dayLabel(x.day)} value={`${x.n}문장`} />)}
          <Row label="외운 문장" value={`${plan.mastered.length}문장`} icon />
        </ul>
      </section>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {plan.due.length > 0 && <Button variant="outline" className="h-12 sm:flex-1" onClick={onMore}>남은 복습 {plan.due.length}문장 더 하기</Button>}
        <Button className="h-12 sm:flex-1" onClick={onBack}>곡 목록으로</Button>
      </div>
    </main>
  )
}

function Num({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 px-2 py-3">
      <p className="text-2xl font-bold tabular-nums">{n}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
function Row({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <li className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-1.5 text-muted-foreground">{icon && <Check className="size-3.5 text-emerald-500" />}{label}</span>
      <b>{value}</b>
    </li>
  )
}
