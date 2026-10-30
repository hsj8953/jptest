'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Eye, RotateCcw, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { blankCorrect, blanksFor } from '@/lib/blanks'
import { DIFFICULTY_LABEL, type Song, type SongProgress } from '@/lib/types'
import { themeStyle, useSongHue } from '@/lib/theme'
import { ProgressBar } from './furigana'

/** 쉬움·보통 결과: 빈칸마다 맞혔는지, 원래 해석과 내 해석 비교 */
export function BlankResults({ song, progress, mode, graded, onBack, onReview, onRestart }: {
  song: Song
  progress: SongProgress
  mode: 'easy' | 'normal'
  graded: number[]
  onBack: () => void
  onReview: (index: number) => void
  onRestart: () => void
}) {
  const theme = useSongHue(song)
  const [onlyWrong, setOnlyWrong] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)

  const rows = useMemo(
    () =>
      graded.map((i) => {
        const p = progress[i] ?? {}
        const bl = blanksFor(song, i)
        const mine = p.blanks ?? []
        const each = bl.answers.map((a, b) => !!mine[b] && (mode === 'easy' ? mine[b] === a.text : blankCorrect(mine[b], a)))
        return { i, bl, mine, each, ok: each.length > 0 && each.every(Boolean), revealed: !!p.revealed, tries: p.tries ?? 0, ko: song.lines[i].ko, translation: (p.translation ?? '').trim() }
      }),
    [graded, progress, song, mode],
  )
  const blanksTotal = rows.reduce((n, r) => n + r.each.length, 0)
  const blanksRight = rows.reduce((n, r) => n + r.each.filter(Boolean).length, 0)
  const perfect = rows.filter((r) => r.ok).length
  const revealed = rows.filter((r) => r.revealed).length
  const acc = blanksTotal ? blanksRight / blanksTotal : 0
  const shown = onlyWrong ? rows.filter((r) => !r.ok) : rows

  return (
    <main className="song-theme mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10" style={themeStyle(theme)}>
      <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />곡 목록
      </button>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        결과 · {DIFFICULTY_LABEL[mode]} · <span className="font-jp normal-case">{song.title}</span>
      </p>
      <h1 className="mt-2 text-3xl font-bold">한 곡을 끝까지 풀었어요</h1>

      <section className="mt-6 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span>빈칸 정확도</span><Target className="size-4" /></div>
          <p className="mt-2 text-5xl font-bold tabular-nums text-primary">{Math.round(acc * 100)}<span className="ml-1 text-2xl">%</span></p>
          <div className="mt-3"><ProgressBar value={acc * 100} /></div>
          <p className="mt-2 text-xs text-muted-foreground">빈칸 {blanksTotal}개 중 {blanksRight}개를 맞혔어요.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">다 맞힌 문장</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{perfect} / {rows.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">정답 보기 사용</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{revealed}번</p>
        </div>
      </section>

      <div className="mt-8 flex justify-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} className="accent-primary" />틀린 문장만 보기
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {shown.length === 0 && <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">틀린 문장이 하나도 없어요. 완벽해요!</p>}
        {shown.map((r) => (
          <article key={r.i} className={`rounded-2xl border bg-card p-4 sm:p-5 ${r.ok ? 'border-border' : 'border-destructive/40'}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-bold">{r.i + 1}</span>
              <span className={r.ok ? 'stamp stamp-ok' : 'stamp stamp-no'}>{r.ok ? '〇 정답' : '✕ 오답'}</span>
              {r.revealed && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Eye className="size-3" />정답 봄</span>}
              {!r.ok && (
                <button onClick={() => onReview(r.i)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10">
                  <RotateCcw className="size-3" />이 문장 다시 풀기
                </button>
              )}
            </div>
            <p lang="ja" className="font-jp text-lg leading-[2.4]">
              {r.bl.parts.map((part, k) => {
                if (part.blank == null) return <span key={k}>{part.text}</span>
                const b = part.blank
                const a = r.bl.answers[b]
                return (
                  <span key={k} className="mx-0.5 inline-flex flex-col items-center align-middle leading-tight">
                    {!r.each[b] && r.mine[b] && <span className="text-xs text-destructive line-through">{r.mine[b]}</span>}
                    <ruby className={`rounded-md px-1.5 ${r.each[b] ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
                      {a.text}
                      <rt className="text-[0.5em] text-muted-foreground">{a.reading}</rt>
                    </ruby>
                  </span>
                )
              })}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="min-w-0 rounded-xl bg-muted/40 p-3">
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">원래 해석</p>
                <p className="text-sm leading-6">{r.ko || <span className="text-muted-foreground">해석 없음</span>}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-muted/40 p-3">
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">내 해석</p>
                <p className="text-sm leading-6">{r.translation || <span className="text-muted-foreground">(안 적음)</span>}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
        {confirmRestart ? (
          <div className="mr-auto flex flex-wrap items-center gap-2 text-sm text-destructive">
            이 난이도의 기록을 지우고 처음부터 다시 풀까요?
            <Button size="sm" variant="outline" onClick={() => setConfirmRestart(false)}>취소</Button>
            <Button size="sm" variant="destructive" onClick={onRestart}>처음부터</Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setConfirmRestart(true)} className="mr-auto"><RotateCcw data-icon="inline-start" />처음부터 다시 풀기</Button>
        )}
        <Button onClick={onBack}>곡 목록으로</Button>
      </div>
    </main>
  )
}
