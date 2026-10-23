'use client'

import { themeStyle, useSongHue } from '@/lib/theme'
import type { Song } from '@/lib/types'

/** 곡 색 테마를 입힌 카드 */
export function ThemedCard({ song, className, children }: { song: Song; className?: string; children: React.ReactNode }) {
  const theme = useSongHue(song)
  return (
    <article className={`song-theme ${className ?? ''}`} style={themeStyle(theme)}>
      {children}
    </article>
  )
}
