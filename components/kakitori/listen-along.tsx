'use client'

import { Crosshair, Pause, Play } from 'lucide-react'
import { useYouTube } from '@/lib/youtube'
import type { Song } from '@/lib/types'

/**
 * 결과 화면: 노래를 처음부터 끝까지 들으면서 지금 부르는 문장 카드를 강조해요.
 * - 넓은 화면: 왼쪽에 영상 고정, 오른쪽에 카드
 * - 좁은 화면: 영상을 헤더 아래에 고정, 카드는 그 아래에서 스크롤
 * - 자동 스크롤은 없어요. '지금 부르는 문장 보기'를 누를 때만 이동해요.
 * - 카드를 누르면 그 문장부터 재생 (playFrom)
 */
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
  const jump = () => {
    if (cur == null) return
    document.getElementById(`result-line-${cur}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!hasVideo) return <>{children({ cur: null, playFrom: () => {} })}</>

  return (
    <div className="lg:grid lg:grid-cols-[minmax(320px,400px)_1fr] lg:items-start lg:gap-6">
      {/* 영상: 좁은 화면은 헤더 아래 고정, 넓은 화면은 왼쪽 열에 고정 */}
      <div className="sticky top-[65px] z-[5] -mx-4 bg-background/95 px-4 pb-2 pt-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-[81px] lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
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
            {cur != null && (
              <button onClick={jump} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-border px-3 text-sm hover:bg-muted">
                <Crosshair className="size-4" />보기
              </button>
            )}
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
    className: `cursor-pointer scroll-mt-[300px] transition ${active ? 'ring-2 ring-primary shadow-lg bg-primary/[0.04]' : 'hover:border-primary/40'}`,
  }
}
