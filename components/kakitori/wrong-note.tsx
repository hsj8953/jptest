'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Eye, NotebookPen, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
import { DIFFICULTY_LABEL, type Difficulty } from '@/lib/types'
import { wrongItems, type WrongItem } from '@/lib/wrong'
import { BackButton } from './furigana'

type Filter = 'all' | Difficulty

/** 오답 노트: 틀렸거나 정답을 본 문장을 모아서 다시 풀어요. 맞히면 바로 빠져요. */
export function WrongNote({ isAdmin, onBack, onOpen }: { isAdmin: boolean; onBack: () => void; onOpen: (item: WrongItem, queue: boolean) => void }) {
  const { songs, progress, ready } = useStore()
  const all = useMemo(() => wrongItems(songs, progress, isAdmin), [songs, progress, isAdmin])
  const [filter, setFilter] = useState<Filter>('all')
  const items = filter === 'all' ? all : all.filter((x) => x.d === filter)

  // 곡별로 묶기
  const groups: { song: WrongItem['song']; items: WrongItem[] }[] = []
  for (const it of items) {
    const g = groups.find((x) => x.song.id === it.song.id)
    if (g) g.items.push(it)
    else groups.push({ song: it.song, items: [it] })
  }

  const count = (d: Filter) => (d === 'all' ? all.length : all.filter((x) => x.d === d).length)

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <BackButton onClick={onBack} />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">間違いノート</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">오답 노트</h1>
      <p className="mt-1 text-sm text-muted-foreground">틀렸거나 정답을 본 문장이 모여요. 다시 풀어서 맞히면 바로 빠져요.</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(['all', 'easy', 'normal', 'hard'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`h-8 rounded-full border px-3 text-xs font-medium transition ${filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40'}`}
          >
            {f === 'all' ? '전체' : DIFFICULTY_LABEL[f]} {count(f)}
          </button>
        ))}
        {items.length > 0 && (
          <Button className="ml-auto h-10" onClick={() => onOpen(items[0], true)}>
            <Play data-icon="inline-start" />오답만 연달아 풀기
          </Button>
        )}
      </div>

      {!ready ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <NotebookPen className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">{all.length === 0 ? '오답 노트가 비어 있어요' : '이 난이도에는 오답이 없어요'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{all.length === 0 ? '틀린 문장이 하나도 없어요. 잘하고 있어요!' : '다른 난이도를 눌러 보세요.'}</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.song.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <h2 className="flex items-baseline gap-2">
                <span className="truncate font-jp text-lg font-bold">{g.song.title}</span>
                <span className="truncate text-sm text-muted-foreground">{g.song.artist}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{g.items.length}문장</span>
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {g.items.map((it) => (
                  <button
                    key={`${it.line}-${it.d}`}
                    onClick={() => onOpen(it, false)}
                    className="group flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-3 text-left transition hover:bg-muted"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background text-xs font-bold">{it.line + 1}</span>
                    <span className="min-w-0 flex-1">
                      {/* 일본어 문장은 정답이라 안 보여 주고, 해석으로 어떤 문장인지 알려 줘요 */}
                      <span className="block truncate text-sm">{g.song.lines[it.line]?.ko || `${it.line + 1}번 문장`}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border px-1.5 py-px">{DIFFICULTY_LABEL[it.d]}</span>
                        {it.tries > 0 && <span>{it.tries}번 시도</span>}
                        {it.revealed && <span className="inline-flex items-center gap-0.5"><Eye className="size-3" />정답 봄</span>}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
