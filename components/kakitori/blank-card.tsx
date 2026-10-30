'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { blankCorrect, blanksFor, choicesFor } from '@/lib/blanks'
import { normalizeKanji } from '@/lib/ruby'
import type { LineProgress, Song } from '@/lib/types'
import { Furigana } from './furigana'

/** 채점 도장 (〇 정답 / ✕ 오답) */
export function Hanko({ ok }: { ok: boolean }) {
  return (
    <span className={`hanko ${ok ? 'hanko-ok' : 'hanko-no'}`} role="img" aria-label={ok ? '정답 도장' : '오답 도장'}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="hanko-rim" cx="50" cy="50" r="45" />
        {ok ? (
          <circle className="hanko-mark" cx="50" cy="50" r="24" pathLength={1} />
        ) : (
          <>
            <path className="hanko-mark" d="M32 32 L68 68" pathLength={1} />
            <path className="hanko-mark hanko-mark-2" d="M68 32 L32 68" pathLength={1} />
          </>
        )}
      </svg>
      <span className="hanko-label">{ok ? '正解' : '不正解'}</span>
    </span>
  )
}

type Graded = { ok: boolean; revealed: boolean; each: boolean[] }

/**
 * 쉬움(보기 고르기) · 보통(직접 쓰기) 빈칸 문제
 * 문장이 바뀌면 key 로 새로 만들어요.
 */
export function BlankCard({ song, lineIndex, mode, prev, onGrade, onReveal, nav }: {
  song: Song
  lineIndex: number
  mode: 'easy' | 'normal'
  prev?: LineProgress
  onGrade: (ok: boolean, answers: string[], translation: string) => void
  onReveal: (translation: string) => void
  nav: (graded: Graded | null, retry: () => void) => React.ReactNode
}) {
  const bl = useMemo(() => blanksFor(song, lineIndex), [song, lineIndex])
  const n = bl.answers.length
  const choices = useMemo(() => (mode === 'easy' ? bl.answers.map((_, b) => choicesFor(song, lineIndex, b)) : []), [mode, bl, song, lineIndex])
  const [answers, setAnswers] = useState<string[]>(() => Array(n).fill(''))
  const [active, setActive] = useState(0)
  const [translation, setTranslation] = useState('')
  const [needKo, setNeedKo] = useState(false)
  const [graded, setGraded] = useState<Graded | null>(null)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const koRef = useRef<HTMLInputElement>(null)
  const line = song.lines[lineIndex]

  useEffect(() => {
    if (mode === 'normal') inputs.current[0]?.focus()
  }, [mode])

  const filled = answers.every((a) => a.trim())
  const canGrade = filled && !!translation.trim()

  const pick = (b: number, v: string) => {
    const next = answers.map((a, i) => (i === b ? v : a))
    setAnswers(next)
    const empty = next.findIndex((a, i) => i > b && !a)
    const anyEmpty = next.findIndex((a) => !a)
    setActive(empty >= 0 ? empty : anyEmpty >= 0 ? anyEmpty : b)
    if (anyEmpty < 0 && !translation.trim()) setTimeout(() => koRef.current?.focus(), 0)
  }

  const grade = () => {
    if (!filled) {
      const e = answers.findIndex((a) => !a.trim())
      setActive(e)
      inputs.current[e]?.focus()
      return
    }
    if (!translation.trim()) {
      setNeedKo(true)
      koRef.current?.focus()
      return
    }
    const each = bl.answers.map((ans, i) => (mode === 'easy' ? answers[i] === ans.text : blankCorrect(answers[i], ans)))
    const ok = each.every(Boolean)
    setGraded({ ok, revealed: false, each })
    onGrade(ok, answers, translation.trim())
  }
  const reveal = () => {
    setGraded({ ok: false, revealed: true, each: bl.answers.map(() => false) })
    onReveal(translation.trim())
  }
  const retry = () => {
    setGraded(null)
    setAnswers(Array(n).fill(''))
    setActive(0)
    setTimeout(() => inputs.current[0]?.focus(), 0)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      if (!graded) grade()
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">
          {mode === 'easy' ? '빈칸에 들어갈 말을 골라 보세요' : '빈칸에 들어갈 말을 써 보세요'}
          <span className="ml-1.5 font-normal text-muted-foreground">({n}개)</span>
        </p>
        {graded && !graded.revealed && <span className={graded.ok ? 'stamp stamp-ok' : 'stamp stamp-no'}>{graded.ok ? '〇 정답' : '✕ 오답'}</span>}
      </div>

      <div className={`relative rounded-xl border-2 border-dashed border-border bg-background p-4 pr-24 ${graded && !graded.revealed ? (graded.ok ? 'answer-ok' : 'answer-no stamp-shake') : ''}`}>
        {graded && !graded.revealed && <Hanko ok={graded.ok} />}
        <p lang="ja" className="jp-writing text-xl leading-[2.6]">
          {bl.parts.map((p, k) => {
            if (p.blank == null) return <span key={k}>{p.text}</span>
            const b = p.blank
            const ans = bl.answers[b]
            const width = `${Math.max(ans.text.length, ans.reading.length * 0.75, 2) + 1.2}em`
            if (graded) {
              const right = graded.each[b]
              return (
                <span key={k} className="relative mx-0.5 inline-flex flex-col items-center align-middle leading-tight">
                  {!right && answers[b] && !graded.revealed && <span className="text-sm text-destructive line-through">{answers[b]}</span>}
                  <ruby className={`rounded-md px-1.5 ${right ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
                    {ans.text}
                    <rt className="text-[0.5em] text-muted-foreground">{ans.reading}</rt>
                  </ruby>
                </span>
              )
            }
            if (mode === 'easy') {
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActive(b)}
                  style={{ minWidth: width }}
                  className={`mx-0.5 inline-flex h-10 items-center justify-center rounded-lg border-2 px-2 align-middle text-lg transition ${active === b ? 'border-primary bg-primary/10' : answers[b] ? 'border-border bg-card' : 'border-dashed border-muted-foreground/40'}`}
                  aria-label={`${b + 1}번 빈칸${answers[b] ? `: ${answers[b]}` : ''}`}
                >
                  {answers[b] || <span className="text-sm text-muted-foreground">{b + 1}</span>}
                </button>
              )
            }
            return (
              <input
                key={k}
                ref={(el) => {
                  inputs.current[b] = el
                }}
                id={`blank-${lineIndex}-${b}`}
                lang="ja"
                value={answers[b]}
                onChange={(e) => setAnswers((a) => a.map((x, i) => (i === b ? e.target.value : x)))}
                onFocus={() => setActive(b)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                    e.preventDefault()
                    const nextEmpty = answers.findIndex((a, i) => i > b && !a.trim())
                    if (nextEmpty >= 0) inputs.current[nextEmpty]?.focus()
                    else if (!translation.trim()) koRef.current?.focus()
                    else grade()
                  }
                }}
                style={{ width }}
                placeholder={`${b + 1}`}
                aria-label={`${b + 1}번 빈칸`}
                className="mx-0.5 inline-block h-10 rounded-lg border-2 border-primary/40 bg-card px-2 text-center align-middle text-lg outline-none focus:border-primary"
              />
            )
          })}
        </p>
      </div>

      {mode === 'easy' && !graded && n > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">{n > 1 ? `${active + 1}번 빈칸의 보기` : '보기'}</p>
          <div className="grid grid-cols-2 gap-2">
            {choices[active]?.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pick(active, c)}
                className={`min-h-12 rounded-xl border px-3 py-2 font-jp text-lg transition hover:border-primary/60 hover:bg-muted ${answers[active] === c ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {mode === 'normal' && !graded && <p className="mt-2 text-xs text-muted-foreground">한자로 써도, 히라가나로 써도 정답이에요.</p>}

      <label htmlFor={`ko-${lineIndex}`} className="mt-5 block text-sm font-semibold">한국어 해석 <span className="font-normal text-destructive">*</span></label>
      <input
        id={`ko-${lineIndex}`}
        ref={koRef}
        value={translation}
        onChange={(e) => {
          setTranslation(e.target.value)
          if (e.target.value.trim()) setNeedKo(false)
        }}
        onKeyDown={onKey}
        placeholder="문장의 뜻을 적어 보세요"
        aria-invalid={needKo}
        disabled={!!graded}
        className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive"
      />
      {needKo && !graded && <p className="mt-2 text-xs text-destructive">한국어 해석까지 적어야 채점할 수 있어요.</p>}

      {graded && (
        <div className="mt-5 rounded-xl bg-muted/60 p-4 text-sm">
          <p className="font-semibold">
            {graded.revealed ? '정답을 확인해 보세요.' : graded.ok ? '잘했어요! 빈칸을 모두 맞혔어요.' : '조금 달라요. 빨간 빈칸의 정답을 확인해 보세요.'}
          </p>
          <p className="mt-4 text-xs font-semibold text-muted-foreground">문장 전체</p>
          <p className="mt-1 font-jp text-xl leading-loose"><Furigana text={normalizeKanji(line.ruby)} /></p>
          <p className="mt-4 text-sm font-semibold text-muted-foreground">원래 해석</p>
          <p className="mt-1 text-base leading-7">{line.ko || <span className="text-muted-foreground">해석 없음</span>}</p>
          {translation.trim() && (
            <>
              <p className="mt-3 text-sm font-semibold text-muted-foreground">내 해석</p>
              <p className="mt-1 text-base leading-7">{translation.trim()}</p>
            </>
          )}
        </div>
      )}

      {!graded ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button className="h-12 w-full text-base sm:h-10 sm:w-auto sm:flex-1 sm:text-sm" onClick={grade} disabled={!canGrade}>
            채점하기 <Check data-icon="inline-end" />
          </Button>
          <button onClick={reveal} className="h-11 rounded-lg px-4 text-sm text-muted-foreground hover:bg-muted sm:h-10">모르겠어요 · 정답 보기</button>
        </div>
      ) : (
        nav(graded, retry)
      )}
      {prev?.tries && !graded ? <p className="mt-3 text-right text-xs text-muted-foreground">이전 시도 {prev.tries}회{prev.ok ? ' · 맞힌 문장' : ''}</p> : null}
    </div>
  )
}

/** 빈칸이 없는 문장 (쉬움·보통): 들어보고 넘어가기 */
export function ListenOnlyCard({ song, lineIndex, nav }: { song: Song; lineIndex: number; nav: React.ReactNode }) {
  const line = song.lines[lineIndex]
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-border bg-card p-4 sm:p-6">
      <p className="text-sm font-semibold">이 문장은 빈칸이 없어요</p>
      <p className="mt-1 text-xs text-muted-foreground">빈칸으로 만들 단어가 없는 짧은 문장이라 듣고 따라 읽어 보세요. 기록에는 들어가지 않아요.</p>
      <p className="mt-4 font-jp text-xl leading-loose"><Furigana text={normalizeKanji(line.ruby)} /></p>
      <p className="mt-2 text-base text-muted-foreground">{line.ko}</p>
      {nav}
    </div>
  )
}
