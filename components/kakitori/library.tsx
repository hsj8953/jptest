'use client'

import { useState } from 'react'
import { ChevronRight, Clock3, FilePenLine, Music2, Play, Plus, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actions, countCorrect, useStore } from '@/lib/store'
import type { Song } from '@/lib/types'
import { ProgressBar } from './furigana'
import { ContinueBanner } from './continue-banner'
import { ThemedCard } from './themed'

const isTimed = (s: Song) => s.lines.length > 0 && s.lines.every((l) => l.start != null)

export function Library({ isAdmin, onSelect, onEdit, onTiming, onInvite, onNew }: {
  isAdmin: boolean
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onTiming: (id: string) => void
  onInvite: () => void
  onNew: () => void
}) {
  const { songs, progress, touched, ready, error } = useStore()
  const [delError, setDelError] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const sorted = [...songs].sort((a, b) => b.createdAt - a.createdAt)
  const solved = songs.reduce((n, s) => n + countCorrect(progress[s.id], s.lines.length), 0)
  // 가장 최근에 공부한 곡 (타이밍이 있어서 풀 수 있는 곡만)
  const recent = songs
    .filter((s) => touched[s.id] && (isTimed(s) || isAdmin))
    .sort((a, b) => (touched[b.id] ?? 0) - (touched[a.id] ?? 0))[0]
  const finished = songs.filter((s) => s.lines.length > 0 && countCorrect(progress[s.id], s.lines.length) === s.lines.length).length

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">今日の練習</p>
          <h1 className="font-jp text-3xl font-bold tracking-tight sm:text-4xl">어떤 노래를 적어볼까요?</h1>
          <p className="mt-2 text-sm text-muted-foreground">가사를 듣고, 천천히 한 글자씩 기록해 보세요.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onInvite}><UserPlus data-icon="inline-start" />친구 초대</Button>
            <Button onClick={onNew}><Plus data-icon="inline-start" />새 곡 등록</Button>
          </div>
        )}
      </div>

      {recent && (
        <ContinueBanner song={recent} progress={progress[recent.id] ?? {}} touchedAt={touched[recent.id]} onContinue={() => onSelect(recent.id)} />
      )}

      <div className="mb-8 grid grid-cols-3 gap-2 sm:max-w-md sm:gap-3">
        <Stat label="전체 곡" value={songs.length} />
        <Stat label="맞힌 문장" value={solved} />
        <Stat label="다 맞힌 곡" value={finished} />
      </div>

      {error && <p className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {delError && <p className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{delError}</p>}
      {!ready && <p className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">곡 목록을 불러오는 중…</p>}

      {ready && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          {isAdmin ? '아직 등록한 곡이 없어요. ‘새 곡 등록’에서 유튜브 링크와 가사를 넣어 주세요.' : '아직 등록된 곡이 없어요. 관리자가 곡을 올리면 여기에 나타나요.'}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {sorted.map((song) => {
          const n = song.lines.length
          const ok = countCorrect(progress[song.id], n)
          const pct = n ? Math.round((ok / n) * 100) : 0
          const timed = isTimed(song)
          return (
            <ThemedCard key={song.id} song={song} className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
              <button
                type="button"
                onClick={() => (timed || isAdmin) && onSelect(song.id)}
                disabled={!timed && !isAdmin}
                aria-label={`${song.title} 공부하기`}
                className="relative mb-4 block aspect-video w-full overflow-hidden rounded-xl bg-muted disabled:cursor-default"
              >
                {song.youtubeId ? (
                  <img
                    src={`https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="grid size-full place-items-center bg-gradient-to-br from-secondary to-muted text-muted-foreground">
                    <Music2 className="size-8" />
                  </span>
                )}
                {(timed || isAdmin) && (
                  <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/30">
                    <span className="grid size-12 scale-90 place-items-center rounded-full bg-white/90 text-slate-900 opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100">
                      <Play className="ml-0.5 size-5 fill-current" />
                    </span>
                  </span>
                )}
                {n > 0 && ok === n && (
                  <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">완주</span>
                )}
              </button>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {!timed && isAdmin && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"><Clock3 className="mr-1 inline size-3" />타이밍 미설정</span>}
                    {!timed && !isAdmin && <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">준비 중</span>}
                    {!song.youtubeId && <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">유튜브 없음</span>}
                    <span className="text-xs text-muted-foreground">{n}문장</span>
                  </div>
                  <h2 className="font-jp text-xl font-bold break-words">{song.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{song.artist}</p>
                </div>
              </div>
              <div className="mt-auto pt-6">
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">내 정답 <b className="text-foreground">{ok} / {n}</b></span>
                  <span className="font-semibold text-primary">{pct}%</span>
                </div>
                <ProgressBar value={pct} />
              </div>
              {timed || isAdmin ? (
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
                  <div className="flex gap-1">
                    {isAdmin && (
                      <>
                        <button onClick={() => onTiming(song.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title="타이밍 설정" aria-label="타이밍 설정"><Clock3 className="size-4" /></button>
                        <button onClick={() => onEdit(song.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title="편집" aria-label="편집"><FilePenLine className="size-4" /></button>
                        <button onClick={() => setConfirmDel(song.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive" title="삭제" aria-label="삭제"><Trash2 className="size-4" /></button>
                      </>
                    )}
                  </div>
                  <Button size="sm" onClick={() => onSelect(song.id)}>{ok ? '이어서 풀기' : '시작하기'}<ChevronRight data-icon="inline-end" /></Button>
                </div>
              ) : (
                <div className="mt-5 border-t border-border pt-4 text-center text-sm text-muted-foreground">관리자가 타이밍을 준비하고 있어요</div>
              )}
              {confirmDel === song.id && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-destructive/10 px-3 py-3 text-sm text-destructive">
                  <span>이 곡과 기록을 모두 지울까요?</span>
                  <span className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setConfirmDel(null)}>취소</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setConfirmDel(null); actions.deleteSong(song.id).catch(() => setDelError('삭제하지 못했어요. 관리자 계정인지 확인해 주세요.')) }}>삭제</Button>
                  </span>
                </div>
              )}
            </ThemedCard>
          )
        })}
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
