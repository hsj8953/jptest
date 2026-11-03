// 오답 노트: 마지막 채점이 틀렸거나 정답 보기를 누른 문장. 한 번 맞히면 바로 빠져요.

import { gradedLines } from './blanks'
import { progKey } from './store'
import { DIFFICULTIES, type Difficulty, type LineProgress, type Song, type SongProgress } from './types'

export const isTimed = (s: Song) => s.lines.length > 0 && s.lines.every((l) => l.start != null)

/** 이 문장이 오답 노트에 있는지 */
export function isWrong(p?: LineProgress) {
  if (!p) return false
  // 정답 보기 기록만 있고 그 뒤로 채점한 적이 없는 옛 기록도 포함해요
  return p.last === false || (!!p.revealed && p.last !== true)
}

export type WrongItem = { song: Song; line: number; d: Difficulty; tries: number; revealed: boolean }

/** 오답 노트 목록 (곡 목록 순서 → 문장 순서 → 쉬움·보통·어려움) */
export function wrongItems(songs: Song[], progress: Record<string, SongProgress>, isAdmin: boolean): WrongItem[] {
  const out: WrongItem[] = []
  const sorted = [...songs].sort((a, b) => b.createdAt - a.createdAt)
  for (const song of sorted) {
    if (!isTimed(song) && !isAdmin) continue
    const perD = DIFFICULTIES.map((d) => ({ d, prog: progress[progKey(song.id, d)], lines: new Set(gradedLines(song, d)) }))
    for (let line = 0; line < song.lines.length; line++) {
      for (const { d, prog, lines } of perD) {
        const p = prog?.[line]
        if (lines.has(line) && isWrong(p)) out.push({ song, line, d, tries: p?.tries ?? 0, revealed: !!p?.revealed })
      }
    }
  }
  return out
}

export const sameItem = (a: { song: Song; line: number; d: Difficulty }, id: string, line: number, d: Difficulty) => a.song.id === id && a.line === line && a.d === d
