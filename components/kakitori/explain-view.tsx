'use client'

import { useState } from 'react'
import { BookOpenText, ChevronDown, Volume2 } from 'lucide-react'
import { speak } from '@/lib/words'
import type { Line } from '@/lib/types'

const POS_COLOR: Record<string, string> = {
  명사: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  대명사: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  동사: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  형용사: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  형용동사: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  부사: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
}

/** 채점한 뒤 보이는 '문장 풀이 보기' (풀이가 없는 문장은 아무것도 안 보여요) */
export function ExplainPanel({ line }: { line?: Line }) {
  const [open, setOpen] = useState(false)
  const ex = line?.explain
  if (!ex) return null
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
      >
        <BookOpenText className="size-4" />
        {open ? '문장 풀이 접기' : '문장 풀이 보기'}
        <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <ExplainBody ex={ex} />}
    </div>
  )
}

export function ExplainBody({ ex }: { ex: NonNullable<Line['explain']> }) {
  return (
    <div className="hint-pop mt-3 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 text-left">
      <section>
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">단어 하나씩</h4>
        <div className="flex flex-col gap-1.5">
          {ex.words.map((w, i) => (
            <button
              type="button"
              key={i}
              onClick={() => speak(w.r || w.w)}
              className="group grid grid-cols-[minmax(4.5rem,auto)_3.5rem_1fr_auto] items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-left transition hover:bg-muted"
              title="눌러서 발음 듣기"
            >
              <span lang="ja" className="font-jp text-lg leading-tight">
                {w.w}
                {w.r && w.r !== w.w && <span className="block text-[11px] text-muted-foreground">{w.r}</span>}
              </span>
              <span className={`rounded-md py-0.5 text-center text-[11px] font-semibold ${POS_COLOR[w.pos] ?? 'bg-muted text-muted-foreground'}`}>{w.pos || '기타'}</span>
              <span className="min-w-0 text-sm">
                {w.m}
                {w.note && <span className="mt-0.5 block text-xs text-primary">{w.note}</span>}
              </span>
              <Volume2 className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </section>
      {ex.grammar.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">문법 포인트</h4>
          <div className="flex flex-col gap-2">
            {ex.grammar.map((g, i) => (
              <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-6 dark:border-amber-500/30 dark:bg-amber-500/10">
                <p lang="ja" className="font-jp font-bold">{g.title}</p>
                <p className="whitespace-pre-line">{g.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {(ex.literal || ex.natural) && (
        <section>
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">해석</h4>
          <dl className="grid grid-cols-[3rem_1fr] gap-x-2 gap-y-1 text-sm leading-6">
            {ex.literal && (<><dt className="text-xs leading-6 text-muted-foreground">직역</dt><dd>{ex.literal}</dd></>)}
            {ex.natural && (<><dt className="text-xs leading-6 text-muted-foreground">의역</dt><dd>{ex.natural}</dd></>)}
          </dl>
        </section>
      )}
      <p className="text-center text-[11px] text-muted-foreground">AI가 만든 풀이라 틀린 부분이 있을 수 있어요 · 단어를 누르면 발음 듣기</p>
    </div>
  )
}
