'use client'

// 곡별 색 테마: 유튜브 썸네일의 대표 색(색상 각도 hue)을 뽑아 포인트 색으로 써요.
// 썸네일을 못 읽거나 색이 너무 무채색이면 곡 ID로 정한 색을 써요.

import { useEffect, useState } from 'react'
import type { Song } from './types'

// v2: OKLCH 기준으로 다시 계산 (v1은 HSL 각도를 그대로 써서 색이 어긋났어요)
const KEY = 'kakitori.hue.v2'
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

// sRGB(0~255) → OKLCH. 화면 테마도 OKLCH를 쓰니까 같은 기준으로 색조를 구해요.
function srgbToLinear(c: number) {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
function rgbToOklch(r8: number, g8: number, b8: number) {
  const r = srgbToLinear(r8)
  const g = srgbToLinear(g8)
  const b = srgbToLinear(b8)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return { L, C, H, A, B }
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
        // OKLCH 색상환을 24칸으로 나눠, 선명하고 너무 어둡거나 밝지 않은 픽셀에 가중치를 줘요
        const bins = new Array(24).fill(0)
        const va = new Array(24).fill(0)
        const vb = new Array(24).fill(0)
        for (let i = 0; i < data.length; i += 4) {
          const { L, C, H, A, B } = rgbToOklch(data[i], data[i + 1], data[i + 2])
          if (C < 0.045 || L < 0.3 || L > 0.92) continue
          const weight = C * (1 - Math.abs(L - 0.62))
          const k = Math.floor(H / 15) % 24
          bins[k] += weight
          // 각도 평균은 벡터로 더해서 구해요 (359도와 1도가 섞여도 안전)
          va[k] += (A / C) * weight
          vb[k] += (B / C) * weight
        }
        // 이웃 칸까지 묶어서 가장 큰 색 덩어리를 골라요
        let best = -1
        let bestScore = 0
        for (let k = 0; k < 24; k++) {
          const score = bins[k] + 0.5 * (bins[(k + 23) % 24] + bins[(k + 1) % 24])
          if (score > bestScore) {
            bestScore = score
            best = k
          }
        }
        if (best < 0 || bins[best] < 1.5) return resolve(null)
        const ks = [(best + 23) % 24, best, (best + 1) % 24]
        const sa = ks.reduce((n, k) => n + va[k], 0)
        const sb = ks.reduce((n, k) => n + vb[k], 0)
        resolve(Math.round(((Math.atan2(sb, sa) * 180) / Math.PI + 360) % 360))
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
