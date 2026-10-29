'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<any> | null = null
function loadYT(): Promise<any> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.append(s)
  })
  return apiPromise
}

/** 유튜브 주소(또는 11자리 ID)에서 영상 ID를 꺼내요. 형식이 아니면 null */
export function parseYouTubeId(input: string): string | null {
  const v = String(input || '').trim()
  if (!v) return null
  if (/^[\w-]{11}$/.test(v)) return v
  try {
    const u = new URL(v.startsWith('http') ? v : 'https://' + v)
    if (u.hostname === 'youtu.be') return /^[\w-]{11}/.exec(u.pathname.slice(1))?.[0] ?? null
    if (u.hostname.endsWith('youtube.com')) {
      const q = u.searchParams.get('v')
      if (q && /^[\w-]{11}$/.test(q.slice(0, 11))) return q.slice(0, 11)
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/)
      if (m) return m[2]
    }
  } catch {
    /* 잘못된 주소 */
  }
  return null
}

export function fmtTime(t: number | null | undefined) {
  if (t == null || Number.isNaN(t)) return '–:––'
  const m = Math.floor(t / 60)
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`
}

type Segment = { start: number; end: number; loop: boolean }

type Options = {
  /** 구간 재생이 아닌데 영상이 재생되기 시작했을 때 (예: 유튜브 화면의 ▶를 직접 누름) */
  onUnmanagedPlay?: () => void
}

/** 페이지 안 유튜브 플레이어 + 문장 구간 재생 */
export function useYouTube(videoId: string | null | undefined, options: Options = {}) {
  const opts = useRef(options)
  opts.current = options
  const hostRef = useRef<HTMLDivElement | null>(null)
  const player = useRef<any>(null)
  const seg = useRef<Segment | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [segActive, setSegActive] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!videoId || !host) return
    let cancelled = false
    const el = document.createElement('div')
    host.replaceChildren(el)
    loadYT().then((YT) => {
      if (cancelled) return
      player.current = new YT.Player(el, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: any) => {
            setReady(true)
            setDuration(e.target.getDuration?.() || null)
          },
          onStateChange: (e: any) => {
            setPlaying(e.data === 1)
            if (e.data === 1) {
              setDuration(player.current?.getDuration?.() || null)
              // 우리 구간 재생이 아닌데 재생이 시작됨 → 화면에 알려서 구간 재생으로 바꿀 수 있게
              if (!seg.current) opts.current.onUnmanagedPlay?.()
            }
          },
        },
      })
    })
    return () => {
      cancelled = true
      try {
        player.current?.destroy()
      } catch {
        /* 무시 */
      }
      player.current = null
      seg.current = null
      setReady(false)
      setPlaying(false)
      setSegActive(false)
    }
  }, [videoId])

  // 0.1초마다 현재 시간 확인 → 구간 끝에서 멈추거나 처음으로 되돌리기
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = player.current
      if (!p?.getCurrentTime) return
      const t = p.getCurrentTime() as number
      setTime(t)
      const s = seg.current
      // 구간 재생 중에 진행 막대를 앞으로 끌어 이전 부분으로 가면 구간 시작으로 되돌려요
      if (s && t < s.start - 0.75) {
        p.seekTo(s.start, true)
        return
      }
      if (s && t >= s.end) {
        if (s.loop) p.seekTo(s.start, true)
        else {
          p.pauseVideo()
          seg.current = null
          setSegActive(false)
        }
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [])

  const playSegment = useCallback((start: number | null, end: number | null, loop = false) => {
    const p = player.current
    if (!p || start == null) return
    seg.current = { start, end: end ?? start + 8, loop }
    setSegActive(true)
    p.seekTo(start, true)
    p.playVideo()
  }, [])
  const setLoop = useCallback((loop: boolean) => {
    if (seg.current) seg.current.loop = loop
  }, [])
  const stop = useCallback(() => {
    seg.current = null
    setSegActive(false)
    player.current?.pauseVideo?.()
  }, [])
  const toggle = useCallback(() => {
    const p = player.current
    if (!p) return
    seg.current = null
    setSegActive(false)
    if (p.getPlayerState() === 1) p.pauseVideo()
    else p.playVideo()
  }, [])
  const seek = useCallback((t: number) => player.current?.seekTo?.(t, true), [])
  const setRate = useCallback((r: number) => player.current?.setPlaybackRate?.(r), [])
  const now = useCallback((): number => player.current?.getCurrentTime?.() ?? 0, [])

  return { hostRef, ready, playing, segActive, time, duration, playSegment, setLoop, stop, toggle, seek, setRate, now }
}
