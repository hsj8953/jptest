// 복습 일정 (화면은 아직 없어요. 오늘의 복습 화면은 다시 설계해서 넣을 예정)
// 틀렸던 문장을 1일 → 3일 → 7일 → 14일 뒤에 다시 풀도록 일정만 기록해 둬요.
// 복습 날에 맞히면 다음 단계로, 틀리면 처음(내일)으로 돌아가요. 14일 단계까지 맞히면 '외움'.
// 기록은 진도(users/{uid}/progress)의 문장별 rv 에 같이 저장돼요.

import { gradedLines } from './blanks'
import { progKey } from './store'
import { DIFFICULTIES, type Difficulty, type LineProgress, type ReviewState, type Song, type SongProgress } from './types'
import { isTimed, isWrong } from './wrong'

export const REVIEW_DAYS = [1, 3, 7, 14]
const DAY = 86_400_000

export const startOfDay = (t = Date.now()) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const dayAfter = (n: number, t = Date.now()) => startOfDay(t) + n * DAY

/** 채점했을 때 복습 일정이 어떻게 바뀌는지. 바뀌지 않으면 원래 값을 돌려줘요 */
export function nextReview(p: LineProgress, ok: boolean, now = Date.now()): ReviewState | undefined {
  // 기능이 생기기 전에 틀린 문장도 복습 0단계로 봐요
  const rv = reviewOf(p) ?? undefined
  if (!ok) return { s: 0, due: dayAfter(1, now) }
  if (!rv || rv.done) return rv
  if (rv.due > now) return rv // 아직 복습할 날이 아니면 그대로 (같은 날 다시 맞혀도 단계는 안 올라가요)
  const s = rv.s + 1
  if (s >= REVIEW_DAYS.length) return { s, due: rv.due, done: true }
  return { s, due: dayAfter(REVIEW_DAYS[s], now) }
}

/** 진도에 넣을 rv 필드 (없으면 아예 안 넣어요) */
export const withReview = (p: LineProgress, ok: boolean): Pick<LineProgress, 'rv'> => {
  const rv = nextReview(p, ok)
  return rv ? { rv } : {}
}

/** 이 문장의 복습 상태. 기능이 생기기 전에 틀린 문장은 '지금 복습할 것'으로 봐요 */
export function reviewOf(p?: LineProgress): ReviewState | null {
  if (!p) return null
  if (p.rv) return p.rv
  return isWrong(p) ? { s: 0, due: 0 } : null
}

export type ReviewItem = { song: Song; line: number; d: Difficulty; rv: ReviewState }
export type ReviewPlan = { due: ReviewItem[]; upcoming: ReviewItem[]; mastered: ReviewItem[] }

export function reviewPlan(songs: Song[], progress: Record<string, SongProgress>, isAdmin: boolean, now = Date.now()): ReviewPlan {
  const plan: ReviewPlan = { due: [], upcoming: [], mastered: [] }
  for (const song of songs) {
    if (!isTimed(song) && !isAdmin) continue
    for (const d of DIFFICULTIES) {
      const prog = progress[progKey(song.id, d)]
      if (!prog) continue
      for (const line of gradedLines(song, d)) {
        const rv = reviewOf(prog[line])
        if (!rv) continue
        const it = { song, line, d, rv }
        if (rv.done) plan.mastered.push(it)
        else if (rv.due <= now) plan.due.push(it)
        else plan.upcoming.push(it)
      }
    }
  }
  plan.due = mixSongs(plan.due.sort((a, b) => a.rv.due - b.rv.due || a.line - b.line))
  plan.upcoming.sort((a, b) => a.rv.due - b.rv.due)
  return plan
}

/** 같은 곡이 연달아 나오지 않게 곡을 번갈아 섞어요 */
function mixSongs(items: ReviewItem[]) {
  const by = new Map<string, ReviewItem[]>()
  for (const it of items) by.set(it.song.id, [...(by.get(it.song.id) ?? []), it])
  const lists = [...by.values()]
  const out: ReviewItem[] = []
  for (let i = 0; out.length < items.length; i++) for (const l of lists) if (l[i]) out.push(l[i])
  return out
}
