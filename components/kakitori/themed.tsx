'use client'

import { themeStyle, useSongHue } from '@/lib/theme'
import type { Song } from '@/lib/types'

/** 곡 색 테마를 입힌 카드 */
export function ThemedCard({ song, className, children }: { song: Song; className?: string; children: React.ReactNode }) {
  const hue = useSongHue(song)
  return (
    <article className={`song-theme ${className ?? ''}`} style={themeStyle(hue)}>
      {children}
    </article>
  )
}
