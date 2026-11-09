'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { loadAllScores, useStore, type ScoreRow } from '@/lib/store'
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty, type Song } from '@/lib/types'
import { gradedLines } from '@/lib/blanks'
import { Stamp } from './stamps'

/**
 * 관리자 전용 '학습 현황': 친구들이 어디까지 공부했는지.
 * 곡별 점수 요약만 읽고, 친구가 적은 답 내용은 보지 않아요.
 */
const BAR: Record<Difficulty, string> = { easy: 'bg-emerald-500', normal: 'bg-amber-500', hard: 'bg-red-500' }
const done = (x: { ok: number; total: number }) => x.total > 0 && x.ok >= x.total
const thumb = (s?: Song) => (s?.youtubeId ? `https://i.ytimg.com/vi/${s.youtubeId}/mqdefault.jpg` : null)

function ago(ms: number) {
  if (!ms) return '—'
  const m = Math.floor((Date.now() - ms) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d === 1) return '어제'
  if (d < 30) return `${d}일 전`
  return new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

type Person = { uid: string; name: string; at: number; rows: ScoreRow[]; ok: number; stamps: Record<Difficulty, number> }

export function AdminProgress({ onBack, onOpenSong }: { onBack: () => void; onOpenSong: (id: string) => void }) {
  const { songs, invites } = useStore()
  const [rows, setRows] = useState<ScoreRow[] | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'people' | 'songs'>('people')
  // undefined = 아직 안 고름(맨 위 사람), null = 접음
  const [sel, setSel] = useState<string | null | undefined>(undefined)

  const load = () => {
    setErr('')
    setRows(null)
    loadAllScores(songs.map((s) => s.id))
      .then(setRows)
      .catch(() => setErr('기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'))
  }
  useEffect(load, [songs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const songOf = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs])
  // 지운 곡의 기록이나 한 문장도 안 맞힌 기록은 빼요
  // 안 해 본 난이도는 전체 문장 수를 곡에서 채워요
  const live = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => songOf.has(r.songId) && DIFFICULTIES.some((d) => r.d[d].ok > 0))
        .map((r) => {
          const song = songOf.get(r.songId)!
          const d = { ...r.d }
          for (const k of DIFFICULTIES) if (!d[k].total) d[k] = { ok: d[k].ok, total: gradedLines(song, k).length }
          return { ...r, d }
        }),
    [rows, songOf],
  )

  const people = useMemo<Person[]>(() => {
    const m = new Map<string, Person>()
    for (const r of live) {
      const p = m.get(r.uid) ?? { uid: r.uid, name: r.name, at: 0, rows: [], ok: 0, stamps: { easy: 0, normal: 0, hard: 0 } }
      if (r.at >= p.at) {
        p.at = r.at
        p.name = r.name // 가장 최근 기록의 닉네임
      }
      p.rows.push(r)
      for (const d of DIFFICULTIES) {
        p.ok += r.d[d].ok
        if (done(r.d[d])) p.stamps[d]++
      }
      m.set(r.uid, p)
    }
    for (const p of m.values()) p.rows.sort((a, b) => b.at - a.at)
    return [...m.values()].sort((a, b) => b.at - a.at)
  }, [live])

  const week = Date.now() - 7 * 864e5
  const total = {
    people: people.length,
    week: people.filter((p) => p.at >= week).length,
    ok: people.reduce((n, p) => n + p.ok, 0),
    stamps: people.reduce((n, p) => n + p.stamps.easy + p.stamps.normal + p.stamps.hard, 0),
  }
  const selected = sel === undefined ? people[0] : people.find((p) => p.uid === sel)

  const bySong = useMemo(() => {
    const m = new Map<string, ScoreRow[]>()
    for (const r of live) m.set(r.songId, [...(m.get(r.songId) ?? []), r])
    return songs
      .filter((s) => m.has(s.id))
      .map((s) => ({ song: s, rows: m.get(s.id)!.sort((a, b) => b.at - a.at) }))
      .sort((a, b) => b.rows.length - a.rows.length || (b.rows[0]?.at ?? 0) - (a.rows[0]?.at ?? 0))
  }, [live, songs])

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" />곡 목록</button>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Admin</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">학습 현황</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">친구들이 어디까지 공부했는지 봐요. 적은 답 내용은 보이지 않아요.</p>
        </div>
        <button onClick={load} disabled={!rows} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"><RefreshCw className="size-4" />새로고침</button>
      </div>

      <div className="mt-5 flex gap-1.5">
        {(['people', 'songs'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`h-9 rounded-full border px-4 text-sm font-semibold transition ${tab === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}>{t === 'people' ? '사람별' : '곡별'}</button>
        ))}
      </div>

      {err ? (
        <p className="mt-8 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>
      ) : !rows ? (
        <p className="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />기록을 불러오는 중…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            {[
              ['공부한 친구', `${total.people}명`],
              ['최근 7일 공부', `${total.week}명`],
              ['맞힌 문장 합계', `${total.ok}`],
              ['받은 완주 도장', `${total.stamps}개`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-card px-4 py-2.5 sm:min-w-40">
                <p className="text-[11px] text-muted-foreground">{k}</p>
                <p className="text-xl font-bold tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          {invites.length > 0 && <p className="mt-2 text-xs text-muted-foreground">초대한 친구 {invites.length}명 · 한 문장이라도 맞힌 사람만 아래에 나와요.</p>}

          {people.length === 0 ? (
            <p className="mt-16 text-center text-sm text-muted-foreground">아직 공부 기록이 없어요.</p>
          ) : tab === 'people' ? (
            <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,34rem)_1fr]">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="grid grid-cols-[1fr_5.5rem_3.5rem_4rem_1rem] gap-2 border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-semibold text-muted-foreground sm:grid-cols-[1fr_6rem_4rem_4.5rem_7rem_1rem]">
                  <span>닉네임</span><span>마지막 공부</span><span>곡</span><span>맞힌 문장</span><span className="hidden sm:block">완주 도장</span><span />
                </div>
                {people.map((p) => {
                  const on = selected?.uid === p.uid
                  const st = DIFFICULTIES.filter((d) => p.stamps[d]).map((d) => `${'易普難'[DIFFICULTIES.indexOf(d)]}${p.stamps[d]}`).join(' · ')
                  return (
                    <div key={p.uid}>
                      <button
                        onClick={() => setSel(on ? null : p.uid)}
                        aria-expanded={on}
                        className={`grid w-full grid-cols-[1fr_5.5rem_3.5rem_4rem_1rem] items-center gap-2 border-b border-border px-4 py-3 text-left text-sm transition last:border-0 sm:grid-cols-[1fr_6rem_4rem_4.5rem_7rem_1rem] ${on ? 'bg-primary/[0.07] shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-muted/50'}`}
                      >
                        <b className="truncate">{p.name}</b>
                        <span className="text-muted-foreground">{ago(p.at)}</span>
                        <span className="tabular-nums">{p.rows.length}곡</span>
                        <span className="tabular-nums">{p.ok}</span>
                        <span className="hidden truncate text-xs text-muted-foreground sm:block">{st || '—'}</span>
                        <ChevronRight className={`size-4 text-muted-foreground transition ${on ? 'rotate-90 lg:rotate-0' : ''}`} />
                      </button>
                      {/* 좁은 화면: 고른 사람 바로 아래에 상세 */}
                      {on && <div className="border-b border-border p-3 lg:hidden"><PersonDetail p={p} songOf={songOf} onOpenSong={onOpenSong} /></div>}
                    </div>
                  )
                })}
              </div>
              <div className="hidden rounded-2xl border border-border bg-card p-5 lg:block">
                {selected ? <PersonDetail p={selected} songOf={songOf} onOpenSong={onOpenSong} /> : <p className="py-16 text-center text-sm text-muted-foreground">왼쪽에서 친구를 고르면 곡별 진행이 나와요.</p>}
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bySong.map(({ song, rows }) => (
                <div key={song.id} className="rounded-2xl border border-border bg-card p-4">
                  <button onClick={() => onOpenSong(song.id)} className="flex w-full items-center gap-3 text-left">
                    {thumb(song) ? <img src={thumb(song)!} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" /> : <span className="h-10 w-16 shrink-0 rounded-md bg-muted" />}
                    <span className="min-w-0 flex-1">
                      <b lang="ja" className="block truncate font-jp">{song.title}</b>
                      <span className="block truncate text-xs text-muted-foreground">{song.artist}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-primary">{rows.length}명 공부 중</span>
                  </button>
                  <div className="mt-2">
                    {rows.map((r) => {
                      const cur = [...DIFFICULTIES].reverse().find((d) => r.d[d].ok > 0 && !done(r.d[d])) ?? [...DIFFICULTIES].reverse().find((d) => r.d[d].ok > 0)!
                      return (
                        <div key={r.uid} className="flex items-center gap-2 border-t border-border py-2 text-sm">
                          <b className="w-20 truncate">{r.name}</b>
                          <span className="flex-1 truncate text-muted-foreground">
                            {DIFFICULTIES.every((d) => done(r.d[d])) ? '🏆 세 난이도 완주' : `${DIFFICULTY_LABEL[cur]} ${r.d[cur].ok}/${r.d[cur].total}`}
                            <span className="ml-1.5 text-xs">· {ago(r.at)}</span>
                          </span>
                          {DIFFICULTIES.map((d) => <Stamp key={d} d={d} on={done(r.d[d])} className="size-6 text-[10px] shadow-none" />)}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}

function PersonDetail({ p, songOf, onOpenSong }: { p: Person; songOf: Map<string, Song>; onOpenSong: (id: string) => void }) {
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <b className="text-lg">{p.name}</b>
        <span className="text-xs text-muted-foreground">{p.rows.length}곡 공부 · 맞힌 문장 {p.ok} · 마지막 {ago(p.at)}</span>
      </p>
      <div className="mt-2">
        {p.rows.map((r) => {
          const s = songOf.get(r.songId)
          return (
            <div key={r.songId} className="flex items-center gap-3 border-t border-border py-3 first:border-0">
              <button onClick={() => onOpenSong(r.songId)} className="shrink-0" title="이 곡 열기">
                {thumb(s) ? <img src={thumb(s)!} alt="" className="h-12 w-20 rounded-lg object-cover sm:h-14 sm:w-24" /> : <span className="block h-12 w-20 rounded-lg bg-muted sm:h-14 sm:w-24" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <b lang="ja" className="truncate font-jp">{s?.title}</b>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{s?.artist}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{ago(r.at)}</span>
                </p>
                <div className="mt-1 grid grid-cols-[2.75rem_1fr_3rem] items-center gap-x-2 gap-y-0.5 text-[11px]">
                  {DIFFICULTIES.map((d) => (
                    <div key={d} className="contents">
                      <span className={done(r.d[d]) ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{DIFFICULTY_LABEL[d]}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className={`block h-full rounded-full ${BAR[d]}`} style={{ width: `${r.d[d].total ? Math.min(100, (r.d[d].ok / r.d[d].total) * 100) : 0}%` }} /></span>
                      <span className="text-right tabular-nums text-muted-foreground">{r.d[d].ok}/{r.d[d].total || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden shrink-0 gap-1 sm:flex">
                {DIFFICULTIES.map((d) => <Stamp key={d} d={d} on={done(r.d[d])} className="size-7 text-xs shadow-none" />)}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">최근에 푼 곡이 위로 와요. 곡 사진을 누르면 그 곡으로 가요.</p>
    </div>
  )
}
