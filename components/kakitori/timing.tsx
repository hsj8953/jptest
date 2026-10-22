'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Clock3, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actions } from '@/lib/store'
import { baseText } from '@/lib/ruby'
import { fmtTime, useYouTube } from '@/lib/youtube'
import type { Line, Song } from '@/lib/types'
import { BackButton } from './furigana'

export function Timing({ song, onBack, onStudy, onEdit }: { song: Song; onBack: () => void; onStudy: (id: string) => void; onEdit: (id: string) => void }) {
  const [lines, setLines] = useState<Line[]>(song.lines)
  const [active, setActive] = useState(() => {
    const first = song.lines.findIndex((l) => l.start == null)
    return first < 0 ? song.lines.length : first
  })
  const [msg, setMsg] = useState('')
  const yt = useYouTube(song.youtubeId)
  const done = active >= lines.length
  const ready = !!song.youtubeId && yt.ready

  const endOf = (i: number) => lines.slice(i + 1).find((l) => l.start != null)?.start ?? yt.duration ?? (lines[i].start ?? 0) + 8

  const stamp = useCallback(() => {
    if (!ready || active >= lines.length) return
    if (!yt.playing) yt.toggle()
    // 버튼 누르는 반응 시간을 감안해 0.15초 앞당겨 저장
    const t = Math.max(0, Number((yt.now() - 0.15).toFixed(2)))
    setLines((L) => L.map((l, j) => (j === active ? { ...l, start: t } : l)))
    setActive((a) => a + 1)
    setMsg('')
  }, [ready, active, lines.length, yt])

  // 스페이스바로 찍기 (입력칸에 있을 때는 무시)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (e.code !== 'Space' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      stamp()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stamp])

  const nudge = (i: number, d: number) => setLines((L) => L.map((l, j) => (j === i && l.start != null ? { ...l, start: Math.max(0, Number((l.start + d).toFixed(2))) } : l)))
  const restart = () => {
    setLines((L) => L.map((l) => ({ ...l, start: null })))
    setActive(0)
    yt.stop()
    yt.seek(0)
    setMsg('')
  }
  const save = async () => {
    try {
      await actions.saveSong({ ...song, lines })
      const missing = lines.filter((l) => l.start == null).length
      setMsg(missing ? `저장했어요. 시작점이 없는 문장 ${missing}개는 친구들이 들을 수 없어요.` : '저장했어요.')
      return true
    } catch {
      setMsg('저장하지 못했어요. 다시 시도해 주세요.')
      return false
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <BackButton onClick={onBack} />
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">관리자 · 타이밍 설정 · <span className="font-jp normal-case">{song.title}</span></p>
          <h1 className="mt-2 text-3xl font-bold">문장마다 시작점을 찍어요</h1>
        </div>
        <span className="self-start rounded-full bg-muted px-3 py-1 font-mono text-sm tabular-nums sm:self-auto">{fmtTime(yt.time)} / {fmtTime(yt.duration)}</span>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950">
        {song.youtubeId ? (
          <div ref={yt.hostRef} className="absolute inset-0 [&_iframe]:size-full" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-400">
            <span className="text-sm">유튜브 링크가 없어서 타이밍을 찍을 수 없어요</span>
            <Button variant="outline" size="sm" onClick={() => onEdit(song.id)}>곡 편집에서 링크 넣기</Button>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" onClick={restart}><RotateCcw data-icon="inline-start" />처음부터 다시 찍기</Button>
        <Button variant="outline" onClick={yt.toggle} disabled={!ready}>
          {yt.playing ? <><Pause data-icon="inline-start" />일시정지</> : <><Play data-icon="inline-start" />재생</>}
        </Button>
        <span className="self-center text-sm text-muted-foreground">스페이스바로도 찍을 수 있어요</span>
      </div>

      <button onClick={stamp} disabled={!ready || done} className="mt-6 w-full rounded-2xl bg-primary p-5 text-left text-primary-foreground shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        <span className="text-xs font-semibold uppercase tracking-widest opacity-70">{done ? '완료' : `현재 문장 ${active + 1} / ${lines.length}`}</span>
        <span className="mt-2 flex items-center justify-between gap-3">
          <span className="font-jp text-lg font-bold">{done ? '모든 문장의 시작점을 찍었어요' : baseText(lines[active].ruby)}</span>
          <Clock3 className="shrink-0" />
        </span>
        <span className="mt-2 block text-sm opacity-80">{done ? '어긋난 곳은 아래에서 ±0.2초로 고쳐 주세요' : '이 문장이 시작되는 순간에 누르세요 →'}</span>
      </button>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">문장 시작 시간</div>
        {lines.map((s, i) => (
          <div key={i} className={`flex flex-wrap items-center gap-3 border-b border-border p-4 last:border-0 ${i === active ? 'bg-primary/5' : ''}`}>
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
            <span className="min-w-0 flex-1 basis-48 font-jp text-sm">{baseText(s.ruby)}</span>
            <span className="w-16 text-right font-mono text-sm tabular-nums text-primary">{s.start == null ? '—' : `${s.start.toFixed(1)}s`}</span>
            <div className="flex gap-1">
              <button onClick={() => nudge(i, -0.2)} disabled={s.start == null} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40" aria-label={`${i + 1}번 0.2초 앞당기기`}>−0.2</button>
              <button onClick={() => nudge(i, 0.2)} disabled={s.start == null} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40" aria-label={`${i + 1}번 0.2초 늦추기`}>+0.2</button>
              <button onClick={() => yt.playSegment(s.start, endOf(i))} disabled={!ready || s.start == null} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40" aria-label={`${i + 1}번 구간 듣기`}><Play className="inline size-3" /></button>
              <button onClick={() => { setActive(i); if (ready && i > 0) { const prev = lines.slice(0, i).reverse().find((l) => l.start != null)?.start; if (prev != null) yt.seek(Math.max(0, prev - 1)) } }} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">여기부터 다시</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {msg && <p className="mr-auto text-sm text-muted-foreground">{msg}</p>}
        <Button variant="outline" onClick={save}>타이밍 저장</Button>
        <Button onClick={async () => { if (await save()) { yt.stop(); onStudy(song.id) } }}>저장하고 직접 풀어보기<ChevronRight data-icon="inline-end" /></Button>
      </div>
    </main>
  )
}
