'use client'

import { useMemo } from 'react'
import { ChevronRight, ListChecks, PenLine, Sparkles } from 'lucide-react'
import { gradedLines } from '@/lib/blanks'
import { countCorrectIn, progKey, useStore } from '@/lib/store'
import { themeStyle, useSongHue } from '@/lib/theme'
import { DIFFICULTY_LABEL, type Difficulty, type Song } from '@/lib/types'
import { BackButton, ProgressBar } from './furigana'

const INFO: Record<Difficulty, { icon: React.ReactNode; desc: string; example: React.ReactNode }> = {
  easy: {
    icon: <ListChecks className="size-5" />,
    desc: '문장의 빈칸에 들어갈 말을 보기 4개 중에서 골라요. 일본어를 처음 배우는 분께 추천해요.',
    example: <>夜空に <b className="rounded border border-dashed border-current px-1.5">？</b> が咲いた → 光 / 花 / 夢 / 心</>,
  },
  normal: {
    icon: <PenLine className="size-5" />,
    desc: '빈칸에 들어갈 말을 직접 써요. 한자로 써도, 히라가나로 써도 정답이에요.',
    example: <>夜空に <b className="rounded border border-dashed border-current px-1.5">ひかり</b> が咲いた</>,
  },
  hard: {
    icon: <Sparkles className="size-5" />,
    desc: '문장 전체를 듣고 받아써요. 가사와 한 글자라도 다르면 오답이에요.',
    example: <>夜空に光が咲いた (전부 직접 쓰기)</>,
  },
}

export function DifficultyPicker({ song, onPick, onBack }: { song: Song; onPick: (d: Difficulty) => void; onBack: () => void }) {
  const { progress } = useStore()
  const theme = useSongHue(song)
  const stats = useMemo(
    () =>
      (['easy', 'normal', 'hard'] as Difficulty[]).map((d) => {
        const lines = gradedLines(song, d)
        const ok = countCorrectIn(progress[progKey(song.id, d)], lines)
        return { d, ok, total: lines.length }
      }),
    [song, progress],
  )

  return (
    <main className="song-theme mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10" style={themeStyle(theme)}>
      <BackButton onClick={onBack} />
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">난이도 선택</p>
      <h1 className="mt-2 font-jp text-2xl font-bold sm:text-3xl">{song.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{song.artist}</p>

      <div className="mt-6 flex flex-col gap-3">
        {stats.map(({ d, ok, total }) => {
          const done = total > 0 && ok === total
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              disabled={total === 0}
              className="group flex w-full items-start gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:p-5"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{INFO[d].icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold">{DIFFICULTY_LABEL[d]}</span>
                  {done && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">완주</span>}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">{INFO[d].desc}</span>
                <span lang="ja" className="mt-2 block font-jp text-sm text-foreground/80">{INFO[d].example}</span>
                {total > 0 ? (
                  <span className="mt-3 block">
                    <span className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>맞힌 문장 {ok} / {total}</span>
                      <span className="tabular-nums">{Math.round((ok / total) * 100)}%</span>
                    </span>
                    <ProgressBar value={(ok / total) * 100} />
                  </span>
                ) : (
                  <span className="mt-3 block text-xs text-muted-foreground">이 곡에는 빈칸을 만들 한자 단어가 없어요.</span>
                )}
              </span>
              <ChevronRight className="mt-3 size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">기록은 난이도마다 따로 저장돼요. 언제든 받아쓰기 화면 위에서 난이도를 바꿀 수 있어요.</p>
    </main>
  )
}
