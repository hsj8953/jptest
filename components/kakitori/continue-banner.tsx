'use client'

import { Music2, Play } from 'lucide-react'
import { themeStyle, useSongHue } from '@/lib/theme'
import type { Song, SongProgress } from '@/lib/types'
import { ProgressBar } from './furigana'

function timeAgo(ms: number) {
  const diff = Date.now() - ms
  const min = Math.round(diff / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}일 전`
  return new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

/** 마지막으로 공부한 곡을 크게 보여주고 바로 이어서 풀게 해요 */
export function ContinueBanner({ song, progress, touchedAt, onContinue }: { song: Song; progress: SongProgress; touchedAt: number; onContinue: () => void }) {
  const hue = useSongHue(song)
  const total = song.lines.length
  const ok = song.lines.filter((_, i) => progress[i]?.ok).length
  const next = song.lines.findIndex((_, i) => !progress[i]?.ok)
  const thumb = song.youtubeId ? `https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg` : null

  return (
    <section className="song-theme relative mb-8 overflow-hidden rounded-3xl border border-border bg-[var(--song-deep)] text-white shadow-lg" style={themeStyle(hue)}>
      {thumb && (
        <img src={thumb} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-45 blur-2xl" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--song-deep)] via-[var(--song-deep)]/80 to-transparent" />
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
        <button
          type="button"
          onClick={onContinue}
          className="group relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl bg-black/30 shadow-xl ring-1 ring-white/15 sm:w-64"
          aria-label={`${song.title} 이어서 풀기`}
        >
          {thumb ? (
            <img src={thumb} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <span className="grid size-full place-items-center text-white/60"><Music2 className="size-10" /></span>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/10 transition group-hover:bg-black/30">
            <span className="grid size-12 place-items-center rounded-full bg-white/95 text-slate-900 shadow-lg transition group-hover:scale-110">
              <Play className="ml-0.5 size-5 fill-current" />
            </span>
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.2em] text-white/70">続きから · 이어서 하기 · {timeAgo(touchedAt)}</p>
          <h2 className="mt-2 truncate font-jp text-2xl font-bold sm:text-3xl">{song.title}</h2>
          <p className="mt-1 text-sm text-white/70">{song.artist}</p>
          <div className="mt-4 max-w-md [&_.bg-muted]:bg-white/20 [&_.bg-primary]:bg-white">
            <div className="mb-1.5 flex justify-between text-xs text-white/80">
              <span>정답 {ok} / {total}</span>
              <span className="tabular-nums">{total ? Math.round((ok / total) * 100) : 0}%</span>
            </div>
            <ProgressBar value={total ? (ok / total) * 100 : 0} />
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow transition hover:-translate-y-px hover:bg-white/90 hover:shadow-lg"
          >
            <Play className="size-4 fill-current" />
            {next < 0 ? '다시 복습하기' : `${next + 1}번 문장부터 이어서`}
          </button>
        </div>
      </div>
    </section>
  )
}
