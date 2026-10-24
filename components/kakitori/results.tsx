'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Eye, RotateCcw, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { answerOf, normalizeAnswer, normalizeKanji, parseRuby } from '@/lib/ruby'
import { diffChars, type DiffChar } from '@/lib/diff'
import type { Song, SongProgress } from '@/lib/types'
import { ProgressBar } from './furigana'
import { themeStyle, useSongHue } from '@/lib/theme'

type Row = {
  index: number
  ruby: string
  ko: string
  answer: string
  translation: string
  ok: boolean
  revealed: boolean
  tries: number
  ans: DiffChar[]
  inp: DiffChar[]
  matched: number
  denom: number
}

const pct = (n: number) => Math.round(n * 100)

export function Results({ song, progress, onBack, onReview, onRestart }: {
  song: Song
  progress: SongProgress
  onBack: () => void
  onReview: (index: number) => void
  onRestart: () => void
}) {
  const [onlyWrong, setOnlyWrong] = useState(false)
  const theme = useSongHue(song)
  const [confirmRestart, setConfirmRestart] = useState(false)

  const rows = useMemo<Row[]>(() =>
    song.lines.map((l, index) => {
      const p = progress[index] ?? {}
      const base = answerOf(l.ruby)
      const answer = normalizeAnswer(p.answer ?? '')
      const { ans, inp } = diffChars(base, answer)
      const matched = ans.filter((c) => !c.bad).length
      const denom = Math.max(Array.from(base).length, Array.from(answer).length)
      return {
        index, ruby: normalizeKanji(l.ruby), ko: l.ko, answer, translation: (p.translation ?? '').trim(),
        ok: answer === base, revealed: !!p.revealed, tries: p.tries ?? 0, ans, inp, matched, denom,
      }
    }), [song.lines, progress])

  const totalMatched = rows.reduce((n, r) => n + r.matched, 0)
  const totalDenom = rows.reduce((n, r) => n + r.denom, 0)
  const accuracy = totalDenom ? totalMatched / totalDenom : 0
  const perfect = rows.filter((r) => r.ok).length
  const revealed = rows.filter((r) => r.revealed).length
  const tries = rows.reduce((n, r) => n + r.tries, 0)
  const shown = onlyWrong ? rows.filter((r) => !r.ok) : rows

  return (
    <main className="song-theme mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10" style={themeStyle(theme)}>
      <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />곡 목록
      </button>

      <p className="text-xs font-semibold uppercase tracking-widest text-primary">결과 · <span className="font-jp normal-case">{song.title}</span></p>
      <h1 className="mt-2 text-3xl font-bold">한 곡을 끝까지 받아썼어요</h1>

      <section className="mt-6 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>글자 정확도</span><Target className="size-4" />
          </div>
          <p className="mt-2 text-5xl font-bold tabular-nums text-primary">{pct(accuracy)}<span className="ml-1 text-2xl">%</span></p>
          <div className="mt-3"><ProgressBar value={accuracy * 100} /></div>
          <p className="mt-2 text-xs text-muted-foreground">전체 {totalDenom}글자 중 {totalMatched}글자를 맞게 적었어요.</p>
        </div>
        <Stat label="완벽한 문장" value={`${perfect} / ${rows.length}`} hint="한 글자도 안 틀린 문장" />
        <Stat label="정답 보기 사용" value={`${revealed}번`} hint="모르겠어요를 누른 문장" />
        <Stat label="총 채점 횟수" value={`${tries}번`} hint="다시 풀기 포함" />
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="rounded-sm bg-destructive/15 px-1 text-destructive underline decoration-wavy underline-offset-4">あ</span>내가 놓친 글자</span>
          <span className="inline-flex items-center gap-1"><span className="text-destructive line-through">あ</span>잘못 적은 글자</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} className="accent-primary" />
          틀린 문장만 보기
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {shown.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">틀린 문장이 하나도 없어요. 완벽해요!</p>
        )}
        {shown.map((r) => (
          <article key={r.index} className={`rounded-2xl border bg-card p-4 sm:p-5 ${r.ok ? 'border-border' : 'border-destructive/40'}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-bold">{r.index + 1}</span>
              <span className={r.ok ? 'stamp stamp-ok' : 'stamp stamp-no'}>{r.ok ? '〇 정답' : '✕ 오답'}</span>
              <span className="text-xs tabular-nums text-muted-foreground">정확도 {pct(r.denom ? r.matched / r.denom : 0)}%</span>
              {r.revealed && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Eye className="size-3" />정답 봄</span>}
              {!r.ok && (
                <button onClick={() => onReview(r.index)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary/10">
                  <RotateCcw className="size-3" />이 문장 다시 풀기
                </button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Cell label="원래 가사">
                <p className="font-jp text-lg leading-loose break-all"><RubyDiff ruby={r.ruby} ans={r.ans} /></p>
              </Cell>
              <Cell label="내가 쓴 가사">
                <p lang="ja" className="font-jp text-lg leading-loose break-all">
                  {r.answer ? r.inp.map((c, k) =>
                    c.bad ? <span key={k} className="text-destructive line-through">{/\s/.test(c.c) ? ' ' : c.c}</span> : <span key={k}>{c.c}</span>,
                  ) : <span className="font-sans text-sm text-muted-foreground">(안 적음)</span>}
                </p>
              </Cell>
              <Cell label="원래 해석" muted>
                <p className="text-sm leading-6">{r.ko || <span className="text-muted-foreground">해석 없음</span>}</p>
              </Cell>
              <Cell label="내 해석" muted>
                <p className="text-sm leading-6">{r.translation || <span className="text-muted-foreground">(안 적음)</span>}</p>
              </Cell>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
        {confirmRestart ? (
          <div className="mr-auto flex flex-wrap items-center gap-2 text-sm text-destructive">
            이 곡의 기록을 지우고 처음부터 다시 풀까요?
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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function Cell({ label, muted, children }: { label: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 rounded-xl p-3 ${muted ? 'bg-muted/40' : 'bg-muted/70'}`}>
      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

/** 후리가나를 살린 채로 놓친 글자에 표시해요 */
function RubyDiff({ ruby, ans }: { ruby: string; ans: DiffChar[] }) {
  let i = 0
  const mark = (ch: string, key: string) => {
    const bad = ans[i++]?.bad
    return bad
      ? <span key={key} className="rounded-sm bg-destructive/15 text-destructive underline decoration-wavy underline-offset-4">{ch}</span>
      : <span key={key}>{ch}</span>
  }
  return (
    <span lang="ja">
      {parseRuby(ruby).map((p, k) => {
        const chars = Array.from(p.text)
        if (!p.reading) return chars.map((ch, j) => mark(ch, `${k}-${j}`))
        return (
          <ruby key={k}>
            {chars.map((ch, j) => mark(ch, `${k}-${j}`))}
            <rt className="text-[0.55em] text-muted-foreground">{p.reading}</rt>
          </ruby>
        )
      })}
    </span>
  )
}
