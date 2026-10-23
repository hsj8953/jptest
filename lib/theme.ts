'use client'

// 곡별 색 테마: 유튜브 썸네일의 대표 색(색상 각도 hue)을 뽑아 포인트 색으로 써요.
// 썸네일을 못 읽거나 색이 너무 무채색이면 곡 ID로 정한 색을 써요.

import { useEffect, useState } from 'react'
import type { Song } from './types'

const KEY = 'kakitori.hue.v1'
const memory = new Map<string, number>()

function loadCache() {
  if (memory.size) return
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) Object.entries(JSON.parse(raw) as Record<string, number>).forEach(([k, v]) => memory.set(k, v))
  } catch {
    /* 무시 */
  }
}
function saveCache() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(memory)))
  } catch {
    /* 무시 */
  }
}

/** 곡마다 항상 같은 기본 색 */
export function fallbackHue(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 360
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

/** 썸네일에서 가장 많이 쓰인 선명한 색의 hue. 못 뽑으면 null */
function extractHue(youtubeId: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = 48
        const h = 27
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, w, h)
        const data = ctx.getImageData(0, 0, w, h).data
        // 색상환을 24칸으로 나눠, 선명하고 너무 어둡거나 밝지 않은 픽셀에 가중치를 줘요
        const bins = new Array(24).fill(0)
        const sums = new Array(24).fill(0)
        for (let i = 0; i < data.length; i += 4) {
          const { h: hue, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2])
          if (s < 0.25 || l < 0.15 || l > 0.85) continue
          const weight = s * (1 - Math.abs(l - 0.5))
          const b = Math.floor(hue / 15) % 24
          bins[b] += weight
          sums[b] += hue * weight
        }
        let best = -1
        for (let b = 0; b < 24; b++) if (best < 0 || bins[b] > bins[best]) best = b
        if (best < 0 || bins[best] < 8) return resolve(null)
        resolve(Math.round(sums[best] / bins[best]))
      } catch {
        resolve(null) // 이미지가 교차 출처라 읽을 수 없는 경우
      }
    }
    img.onerror = () => resolve(null)
    img.src = `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`
  })
}

/** 곡의 테마 색상 각도(0~360) */
export function useSongHue(song: Pick<Song, 'id' | 'youtubeId'> | null | undefined) {
  const key = song ? `${song.id}:${song.youtubeId ?? ''}` : ''
  const [hue, setHue] = useState<number>(() => (song ? fallbackHue(song.id) : 250))

  useEffect(() => {
    if (!song) return
    loadCache()
    const cached = memory.get(key)
    if (cached != null) {
      setHue(cached)
      return
    }
    setHue(fallbackHue(song.id))
    if (!song.youtubeId) return
    let alive = true
    extractHue(song.youtubeId).then((h) => {
      const value = h ?? fallbackHue(song.id)
      memory.set(key, value)
      saveCache()
      if (alive) setHue(value)
    })
    return () => {
      alive = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return hue
}

/** 테마를 적용할 요소에 붙일 style */
export const themeStyle = (hue: number) => ({ '--song-h': String(hue) }) as React.CSSProperties
