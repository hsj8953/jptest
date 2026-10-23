'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { joinRuby, splitRuby, type Segment } from '@/lib/ruby'

/**
 * 한자 단어를 눌러서 읽기를 고치는 후리가나 보기 (관리자용)
 * - check 에 있는 단어는 노랗게 표시돼요
 * - 읽기를 고치거나 '맞아요'를 누르면 노란 표시가 사라져요
 */
export function RubyEditable({ value, check = [], onChange, className = '' }: {
  value: string
  check?: string[]
  onChange: (ruby: string, check: string[]) => void
  className?: string
}) {
  const segs = splitRuby(value)
  const [open, setOpen] = useState<number | null>(null)

  const update = (i: number, reading: string) => {
    const next: Segment[] = segs.map((g, k) => (k === i ? { ...g, reading: reading.trim() || undefined } : g))
    const word = segs[i].text
    onChange(joinRuby(next), check.filter((c) => c !== word))
    setOpen(null)
  }

  return (
    <span lang="ja" className={`font-jp leading-[2.4] ${className}`}>
      {segs.map((g, i) => {
        if (!g.kanji) return <span key={i}>{g.text}</span>
        const flagged = check.includes(g.text)
        return (
          <span key={i} className="relative inline-block">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className={`rounded-md px-0.5 transition hover:bg-primary/10 hover:ring-1 hover:ring-primary/40 ${flagged ? 'bg-amber-200/70 ring-1 ring-amber-400 dark:bg-amber-500/25 dark:ring-amber-500/60' : ''} ${!g.reading ? 'underline decoration-dotted decoration-destructive underline-offset-4' : ''}`}
              title={flagged ? '읽기를 확인해 주세요 · 눌러서 고치기' : '눌러서 읽기 고치기'}
              aria-label={`${g.text} 읽기 ${g.reading ?? '없음'}${flagged ? ', 확인 필요' : ''}`}
            >
              <ruby>
                {g.text}
                <rt className={`text-[0.55em] ${flagged ? 'font-bold text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>{g.reading ?? '?'}</rt>
              </ruby>
            </button>
            {open === i && (
              <ReadingPopover
                word={g.text}
                reading={g.reading ?? ''}
                flagged={flagged}
                onSave={(r) => update(i, r)}
                onConfirm={() => {
                  onChange(value, check.filter((c) => c !== g.text))
                  setOpen(null)
                }}
                onClose={() => setOpen(null)}
              />
            )}
          </span>
        )
      })}
    </span>
  )
}

function ReadingPopover({ word, reading, flagged, onSave, onConfirm, onClose }: {
  word: string
  reading: string
  flagged: boolean
  onSave: (r: string) => void
  onConfirm: () => void
  onClose: () => void
}) {
  const [v, setV] = useState(reading)
  const ref = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  return (
    <div ref={box} className="absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-xl border border-border bg-popover p-3 font-sans text-sm shadow-xl">
      <p className="mb-2 text-xs text-muted-foreground"><span className="font-jp text-base text-foreground">{word}</span> 의 읽기</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave(v)
        }}
        className="flex gap-1.5"
      >
        <input
          ref={ref}
          lang="ja"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="ひらがな"
          className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 font-jp outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="submit" className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/85">저장</button>
      </form>
      {flagged && (
        <button type="button" onClick={onConfirm} className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-xs hover:bg-muted">
          <Check className="size-3.5" />지금 읽기가 맞아요
        </button>
      )}
    </div>
  )
}
