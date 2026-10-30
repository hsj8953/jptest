export type Line = {
  /** 후리가나 표기 포함 문장. 예: 夜空{よぞら}に光{ひかり}が */
  ruby: string
  ko: string
  /** 문장 시작 시간(초). 아직 안 찍었으면 null */
  start: number | null
  /** 읽기를 다시 확인해야 하는 한자 단어들 (관리자 화면에서만 노랗게 표시) */
  check?: string[]
}

/** 곡에서 뽑은 한자 단어 (단어장용) */
export type SongWord = {
  /** 사전형 (예: 咲く) */
  word: string
  /** 사전형의 히라가나 읽기 (예: さく) */
  reading: string
  /** 한국어 뜻 */
  meaning: string
  /** 이 단어가 나온 문장 번호들 (0부터) */
  lines: number[]
}

export type Song = {
  id: string
  title: string
  artist: string
  youtubeId: string | null
  lines: Line[]
  /** 단어장에 들어갈 한자 단어 */
  words?: SongWord[]
  createdAt: number
}

export type LineProgress = {
  ok?: boolean
  last?: boolean
  tries?: number
  ko?: boolean
  revealed?: boolean
  /** 마지막으로 제출한 일본어 받아쓰기 */
  answer?: string
  /** 마지막으로 적은 한국어 해석 */
  translation?: string
  /** 쉬움·보통: 빈칸마다 내가 고르거나 쓴 답 */
  blanks?: string[]
}

/** 받아쓰기 난이도: 쉬움(빈칸 고르기) · 보통(빈칸 쓰기) · 어려움(문장 전체 받아쓰기) */
export type Difficulty = 'easy' | 'normal' | 'hard'
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: '쉬움', normal: '보통', hard: '어려움' }
export type SongProgress = Record<number, LineProgress>

export type User = {
  uid: string
  name: string
  email: string
  isAdmin: boolean
}

/** 단어장 진도: 단어·가나별 숙련도 (0 = 모름, 높을수록 잘 앎) */
export type VocabProgress = {
  words: Record<string, number>
  kana: Record<string, number>
}
