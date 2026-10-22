export type Line = {
  /** 후리가나 표기 포함 문장. 예: 夜空{よぞら}に光{ひかり}が */
  ruby: string
  ko: string
  /** 문장 시작 시간(초). 아직 안 찍었으면 null */
  start: number | null
}

export type Song = {
  id: string
  title: string
  artist: string
  youtubeId: string | null
  lines: Line[]
  createdAt: number
}

export type LineProgress = {
  ok?: boolean
  last?: boolean
  tries?: number
  ko?: boolean
  revealed?: boolean
}
export type SongProgress = Record<number, LineProgress>

export type User = {
  uid: string
  name: string
  email: string
  isAdmin: boolean
}
