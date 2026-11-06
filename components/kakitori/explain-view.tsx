'use client'

import { useEffect, useState } from 'react'
import { BookOpenText, ChevronDown, Volume2 } from 'lucide-react'
import { speak } from '@/lib/words'
import { readingsFromRuby } from '@/lib/ruby'
import type { Line } from '@/lib/types'

const POS_COLOR: Record<string, string> = {
  명사: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  대명사: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  동사: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  형용사: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  형용동사: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  부사: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
}

const TIP_KEY = 'kakitori.hint.explain.v1'

/** 채점한 뒤 보이는 '문장 풀이 보기' (풀이가 없는 문장은 아무것도 안 보여요) */
export function ExplainPanel({ line }: { line?: Line }) {
  const [open, setOpen] = useState(false)
  // 처음 한 번만 '여기 문장 풀이가 있어요' 말풍선
  const [tip, setTip] = useState(false)
  const ex = line?.explain
  useEffect(() => {
    if (!ex) return
    try {
      if (!window.localStorage.getItem(TIP_KEY)) setTip(true)
    } catch {}
  }, [ex])
  const hideTip = () => {
    setTip(false)
    try {
      window.localStorage.setItem(TIP_KEY, '1')
    } catch {}
  }
  if (!ex) return null
  return (
    <div className="relative mt-4">
      <button
        type="button"
        onClick={() => {
          hideTip()
          setOpen((o) => !o)
        }}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 ${tip ? 'listen-pulse' : ''}`}
      >
        <BookOpenText className="size-4" />
        {open ? '문장 풀이 접기' : '문장 풀이 보기'}
        <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {tip && !open && (
        <div role="note" className="hint-pop relative z-10 mt-3 sm:w-96">
          <span className="absolute -top-1.5 left-8 size-3 rotate-45 border-l border-t border-primary/40 bg-card" aria-hidden />
          <div className="rounded-2xl border border-primary/40 bg-card p-4 text-sm shadow-xl">
            <p className="font-semibold text-foreground">📖 채점이 끝나면 문장 풀이를 볼 수 있어요</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-muted-foreground">
              <li>· 단어마다 뜻·품사와 짧은 설명이 있어요.</li>
              <li>· 이 문장에서 배울 만한 <b className="text-foreground">문법 포인트</b>를 알려 줘요.</li>
              <li>· 직역·의역을 나란히 보여 줘서 뜻이 어떻게 만들어지는지 알 수 있어요.</li>
            </ul>
            <button onClick={hideTip} className="mt-3 w-full rounded-lg bg-primary/10 py-2 text-sm font-semibold text-primary hover:bg-primary/15">알겠어요</button>
          </div>
        </div>
      )}
      {open && <ExplainBody ex={ex} ruby={line?.ruby} />}
    </div>
  )
}

export function ExplainBody({ ex, ruby }: { ex: NonNullable<Line['explain']>; ruby?: string }) {
  // 읽기는 가사에 적힌 후리가나(노래에서 부르는 읽기)를 먼저 쓰고, 없으면 AI가 준 읽기
  const fromLyric = ruby ? readingsFromRuby(ruby, ex.words.map((w) => w.w)) : []
  const readOf = (i: number) => fromLyric[i] ?? ex.words[i].r
  return (
    <div className="hint-pop mt-3 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 text-left">
      <section>
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">단어 하나씩</h4>
        <div className="flex flex-col gap-1.5">
          {ex.words.map((w, i) => (
            <button
              type="button"
              key={i}
              onClick={() => speak(readOf(i) || w.w)}
              className="group grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1 rounded-xl bg-muted/50 px-3 py-2 text-left transition hover:bg-muted sm:grid-cols-[minmax(4.5rem,11rem)_3.5rem_1fr_auto]"
              title="눌러서 발음 듣기"
            >
              {/* 휴대폰: 윗줄 단어·품사·소리, 아랫줄 뜻 / 넓은 화면: 한 줄 */}
              <span lang="ja" className="min-w-0 break-all font-jp text-lg leading-tight">
                {w.w}
                {readOf(i) && readOf(i) !== w.w && <span className="block text-[11px] text-muted-foreground">{readOf(i)}</span>}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-center text-[11px] font-semibold sm:px-0 ${POS_COLOR[w.pos] ?? 'bg-muted text-muted-foreground'}`}>{w.pos || '기타'}</span>
              <span className="order-last col-span-3 min-w-0 text-sm sm:order-none sm:col-span-1">
                {w.m}
                {w.note && <span className="mt-0.5 block text-xs text-primary">{w.note}</span>}
              </span>
              <Volume2 className="size-3.5 text-muted-foreground opacity-60 transition sm:opacity-0 sm:group-hover:opacity-100" />
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
