'use client'

import { useMemo, useState } from 'react'
import { BookOpen, ChartNoAxesColumn, ChevronRight, CircleHelp, Clock3, FilePenLine, Music2, NotebookPen, Play, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actions, countCorrectIn, parseProgKey, progKey, useStore, type SongRequest } from '@/lib/store'
import { gradedLines } from '@/lib/blanks'
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from '@/lib/types'
import type { Song } from '@/lib/types'
import { ProgressBar } from './furigana'
import { ContinueBanner } from './continue-banner'
import { ThemedCard } from './themed'
import { wrongItems } from '@/lib/wrong'
import { InstallBanner } from './install-banner'
import { Stamp } from './stamps'
import { NewsBanner } from './news'
import { AddedNotice, SongRequestList, SongRequestModal } from './song-request'

const isTimed = (s: Song) => s.lines.length > 0 && s.lines.every((l) => l.start != null)

export function Library({ isAdmin, onSelect, onEdit, onTiming, onInvite, onNew, onVocab, onWrong, onRegisterRequest, onHelp, onStampBook, onProgress, onNews }: {
  isAdmin: boolean
  onSelect: (id: string, d?: Difficulty) => void
  onEdit: (id: string) => void
  onTiming: (id: string) => void
  onInvite: () => void
  onNew: () => void
  onVocab: () => void
  onWrong: () => void
  onHelp: () => void
  onStampBook: () => void
  onProgress?: () => void
  onNews?: () => void
  onRegisterRequest: (r: SongRequest) => void
}) {
  const { songs, progress, touched, ready, error, requests, songRequests } = useStore()
  const [delError, setDelError] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [reqOpen, setReqOpen] = useState(false)
  const wrongCount = useMemo(() => wrongItems(songs, progress, isAdmin).length, [songs, progress, isAdmin])
  const sorted = [...songs].sort((a, b) => b.createdAt - a.createdAt)
  // 곡 × 난이도별 진행 상황
  const stat = (song: Song, d: Difficulty) => {
    const lines = gradedLines(song, d)
    return { d, ok: countCorrectIn(progress[progKey(song.id, d)], lines), total: lines.length }
  }
  const solved = songs.reduce((n, s) => n + DIFFICULTIES.reduce((m, d) => m + stat(s, d).ok, 0), 0)
  // 가장 최근에 공부한 곡과 난이도 (타이밍이 있어서 풀 수 있는 곡만)
  const recent = Object.entries(touched)
    .map(([key, at]) => ({ ...parseProgKey(key), at }))
    .filter((r) => r.at && songs.some((s) => s.id === r.songId && (isTimed(s) || isAdmin)))
    .sort((a, b) => b.at - a.at)[0]
  const recentSong = recent ? songs.find((s) => s.id === recent.songId) : undefined
  const finished = songs.filter((s) => DIFFICULTIES.some((d) => {
    const x = stat(s, d)
    return x.total > 0 && x.ok === x.total
  })).length

  // 검색: 제목·가수에서 찾아요 (대소문자, 히라가나/가타카나, 띄어쓰기 구분 없이)
  const norm = (t: string) => t.toLowerCase().replace(/[\s\u3000]+/g, '').replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  const nq = norm(q)
  const shown = nq ? sorted.filter((s) => norm(`${s.title} ${s.artist}`).includes(nq)) : sorted

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">今日の練習</p>
          <h1 className="font-jp text-3xl font-bold tracking-tight sm:text-4xl">어떤 노래를 적어볼까요?</h1>
          <p className="mt-2 text-sm text-muted-foreground">가사를 듣고, 천천히 한 글자씩 기록해 보세요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onHelp} className="h-10 px-3"><CircleHelp data-icon="inline-start" />사용법</Button>
          <Button variant="outline" onClick={onVocab} className="h-10 px-3"><BookOpen data-icon="inline-start" />단어장</Button>
          <Button variant="outline" onClick={onStampBook} className="h-10 px-3"><Stamp d="normal" on className="mr-0.5 size-5 text-[10px] shadow-none" />도장 수첩</Button>
          <Button variant="outline" onClick={onWrong} className="h-10 px-3"><NotebookPen data-icon="inline-start" />오답 노트{wrongCount > 0 && <span className="ml-0.5 rounded-full bg-destructive/10 px-1.5 text-xs font-bold text-destructive tabular-nums">{wrongCount}</span>}</Button>
          <Button variant="outline" onClick={() => setReqOpen(true)} className="relative h-10 px-3">
            <Music2 data-icon="inline-start" />{isAdmin ? '곡 신청 목록' : '곡 신청'}
            {isAdmin && songRequests.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-5 text-white">{songRequests.length}</span>}
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" onClick={onProgress} className="h-10 px-3"><ChartNoAxesColumn data-icon="inline-start" />학습 현황</Button>
              <Button variant="outline" onClick={onInvite} className="relative h-10 px-3">
                <UserPlus data-icon="inline-start" />친구 초대
                {requests.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-5 text-white">{requests.length}</span>}
              </Button>
              <Button onClick={onNew} className="h-10 px-3"><Plus data-icon="inline-start" />새 곡 등록</Button>
            </>
          )}
        </div>
      </div>

      {onNews && <NewsBanner onOpen={onNews} />}
      <InstallBanner />
      {!isAdmin && <AddedNotice onOpen={(id) => onSelect(id)} />}

      {isAdmin && songRequests.length > 0 && (
        <button onClick={() => setReqOpen(true)} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-left text-sm transition hover:bg-primary/15">
          <Music2 className="size-4 shrink-0 text-primary" />
          <span className="flex-1"><b>곡 신청 {songRequests.length}건</b>이 들어왔어요.</span>
          <span className="text-xs font-semibold text-primary">확인하기 →</span>
        </button>
      )}

      {reqOpen && (isAdmin
        ? <SongRequestList onClose={() => setReqOpen(false)} onRegister={(r) => { setReqOpen(false); onRegisterRequest(r) }} />
        : <SongRequestModal onClose={() => setReqOpen(false)} />)}

      {isAdmin && requests.length > 0 && (
        <button onClick={onInvite} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-left text-sm transition hover:bg-primary/15">
          <UserPlus className="size-4 shrink-0 text-primary" />
          <span className="flex-1"><b>승인 요청 {requests.length}건</b>이 기다리고 있어요.</span>
          <span className="text-xs font-semibold text-primary">확인하기 →</span>
        </button>
      )}

      {recent && recentSong && (
        <ContinueBanner
          song={recentSong}
          difficulty={recent.d}
          progress={progress[progKey(recentSong.id, recent.d)] ?? {}}
          touchedAt={recent.at}
          onContinue={() => onSelect(recentSong.id, recent.d)}
        />
      )}

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid grid-cols-3 gap-2 sm:max-w-md sm:flex-1 sm:gap-3">
          <Stat label="전체 곡" value={songs.length} />
          <Stat label="맞힌 문장" value={solved} />
          <Stat label="다 맞힌 곡" value={finished} />
        </div>
        <label className="relative sm:ml-auto sm:w-72">
          <span className="sr-only">노래 검색</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="song-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="곡 제목이나 가수로 찾기"
            className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="검색어 지우기">
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      {error && <p className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {delError && <p className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{delError}</p>}
      {!ready && <p className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">곡 목록을 불러오는 중…</p>}

      {ready && sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          {isAdmin ? '아직 등록한 곡이 없어요. ‘새 곡 등록’에서 유튜브 링크와 가사를 넣어 주세요.' : '아직 등록된 곡이 없어요. 관리자가 곡을 올리면 여기에 나타나요.'}
        </div>
      )}

      {ready && sorted.length > 0 && shown.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">‘{q.trim()}’ 에 맞는 곡이 없어요.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((song) => {
          const n = song.lines.length
          const stats = DIFFICULTIES.map((d) => stat(song, d))
          const started = stats.some((x) => x.ok > 0 || Object.keys(progress[progKey(song.id, x.d)] ?? {}).length > 0)
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
                {(timed || isAdmin) && (
                  <span className="absolute right-2 top-2 flex gap-1">
                    {stats.map((x) => <Stamp key={x.d} d={x.d} on={x.total > 0 && x.ok === x.total} onPhoto className="size-8 text-sm sm:size-9 sm:text-base" />)}
                  </span>
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
              <div className="mt-auto flex flex-col gap-1.5 pt-5">
                {stats.map((x) => {
                  const pct = x.total ? Math.round((x.ok / x.total) * 100) : 0
                  const done = x.total > 0 && x.ok === x.total
                  return (
                    <button
                      key={x.d}
                      type="button"
                      onClick={() => (timed || isAdmin) && x.total > 0 && onSelect(song.id, x.d)}
                      disabled={(!timed && !isAdmin) || x.total === 0}
                      className="grid grid-cols-[3.25rem_1fr_3.5rem] items-center gap-2 rounded-lg px-1 py-0.5 text-left text-xs transition hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                      title={`${DIFFICULTY_LABEL[x.d]}으로 풀기`}
                    >
                      <span className={`font-semibold ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{DIFFICULTY_LABEL[x.d]}{done && ' ✓'}</span>
                      <ProgressBar value={pct} />
                      <span className="text-right tabular-nums text-muted-foreground">{x.total ? `${x.ok}/${x.total}` : '—'}</span>
                    </button>
                  )
                })}
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
                  <Button size="sm" onClick={() => onSelect(song.id)}>{started ? '이어서 풀기' : '시작하기'}<ChevronRight data-icon="inline-end" /></Button>
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
