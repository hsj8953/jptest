'use client'

import { useEffect, useRef, useState } from 'react'
import { Crosshair, Pause, Play, ScrollText } from 'lucide-react'
import { useYouTube } from '@/lib/youtube'
import type { Song } from '@/lib/types'

/**
 * 결과 화면: 노래를 처음부터 끝까지 들으면서 지금 부르는 문장 카드를 강조해요.
 * - 넓은 화면: 왼쪽에 영상 고정, 오른쪽에 카드
 * - 좁은 화면: 영상을 헤더 아래에 고정, 카드는 그 아래에서 스크롤
 * - 자동 스크롤은 기본으로 꺼져 있고, 버튼으로 켜고 끌 수 있어요 (기기마다 기억). '보기'는 한 번만 이동해요.
 * - 카드를 누르면 그 문장부터 재생 (playFrom)
 */
const AUTO_KEY = 'kakitori.results.autoscroll'

export function ListenAlong({ song, children }: { song: Song; children: (p: { cur: number | null; playFrom: (i: number) => void }) => React.ReactNode }) {
  const yt = useYouTube(song.youtubeId)
  const starts = song.lines.map((l) => l.start)
  const hasVideo = !!song.youtubeId && starts.some((s) => s != null)

  // 지금 시간에 부르고 있는 문장 (재생을 한 번이라도 했을 때만)
  let cur: number | null = null
  if (hasVideo && (yt.playing || yt.time > 0.2)) {
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i]
      if (s != null && s <= yt.time + 0.1) cur = i
    }
  }

  const playFrom = (i: number) => {
    const s = starts[i]
    if (!yt.ready || s == null) return
    yt.seek(Math.max(0, s - 0.2))
    if (!yt.playing) yt.toggle()
  }
  // 고정된 영상(좁은 화면)이나 헤더에 카드 윗부분이 가리지 않게, 그 아래로 여유 있게 맞춰 이동해요
  const stickyRef = useRef<HTMLDivElement | null>(null)
  const scrollToLine = (i: number) => {
    const el = document.getElementById(`result-line-${i}`)
    if (!el) return
    const wide = window.matchMedia('(min-width: 1024px)').matches
    // 좁은 화면: 영상이 헤더(65px) 아래에 붙었을 때의 아래쪽 끝 기준
    const top = wide ? 65 : 65 + (stickyRef.current?.offsetHeight ?? 0)
    // 좁은 화면은 아래 공간이 빠듯해서 영상 바로 아래에 붙여요 (6px), 넓은 화면은 16px
    const y = el.getBoundingClientRect().top + window.scrollY - top - (wide ? 16 : 6)
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
  }
  const jump = () => {
    if (cur != null) scrollToLine(cur)
  }

  const [auto, setAuto] = useState(false)
  useEffect(() => {
    try {
      setAuto(window.localStorage.getItem(AUTO_KEY) === '1')
    } catch {}
  }, [])
  const toggleAuto = () => {
    const next = !auto
    setAuto(next)
    try {
      window.localStorage.setItem(AUTO_KEY, next ? '1' : '0')
    } catch {}
    if (next && cur != null) scrollToLine(cur)
  }
  // 자동 스크롤: 부르는 문장이 바뀔 때마다 그 카드로
  useEffect(() => {
    if (auto && cur != null && yt.playing) scrollToLine(cur)
  }, [auto, cur]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasVideo) return <>{children({ cur: null, playFrom: () => {} })}</>

  return (
    <div className="lg:grid lg:grid-cols-[minmax(320px,400px)_1fr] lg:items-start lg:gap-6">
      {/* 영상: 좁은 화면은 헤더 아래 고정, 넓은 화면은 왼쪽 열에 고정 */}
      <div ref={stickyRef} className="sticky top-[65px] z-[5] -mx-4 bg-background/95 px-4 pb-2 pt-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-[81px] lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto max-w-xl lg:max-w-none">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-md">
            <div ref={yt.hostRef} className="absolute inset-0 [&_iframe]:size-full" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={yt.toggle}
              disabled={!yt.ready}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {yt.playing ? <><Pause className="size-4" />멈추기</> : <><Play className="size-4" />{yt.time > 0.2 ? '이어서 듣기' : '처음부터 듣기'}</>}
            </button>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {cur != null ? <>지금 <b className="text-foreground">{cur + 1}번 문장</b></> : '카드를 누르면 그 문장부터 들어요'}
            </span>
            {cur != null && !auto && (
              <button onClick={jump} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-border px-3 text-sm hover:bg-muted">
                <Crosshair className="size-4" />보기
              </button>
            )}
            <button
              onClick={toggleAuto}
              aria-pressed={auto}
              title="부르는 문장을 따라 자동으로 스크롤"
              className={`inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border px-3 text-sm transition ${auto ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border hover:bg-muted'}`}
            >
              <ScrollText className="size-4" />자동<span className="hidden sm:inline"> 스크롤</span> {auto ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-2 lg:mt-0">{children({ cur, playFrom })}</div>
    </div>
  )
}

/** 결과 카드에 붙이는 강조·클릭 속성 */
export function lineCardProps(i: number, cur: number | null, playFrom: (i: number) => void) {
  const active = cur === i
  return {
    id: `result-line-${i}`,
    onClick: (e: React.MouseEvent) => {
      // 카드 안의 버튼·링크를 누른 건 재생으로 치지 않아요
      if ((e.target as HTMLElement).closest('button, a, input, label')) return
      playFrom(i)
    },
    'data-active': active || undefined,
    className: `cursor-pointer transition ${active ? 'ring-2 ring-primary shadow-lg bg-primary/[0.04]' : 'hover:border-primary/40'}`,
  }
}
