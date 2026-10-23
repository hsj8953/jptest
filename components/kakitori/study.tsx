'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Headphones, Pause, RotateCcw, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actions, countCorrect, useStore, watchScores, type Score } from '@/lib/store'
import { baseText } from '@/lib/ruby'
import { diffChars, type DiffChar } from '@/lib/diff'
import { useYouTube } from '@/lib/youtube'
import type { Song, User } from '@/lib/types'
import { BackButton, Furigana, ProgressBar } from './furigana'
import { themeStyle, useSongHue } from '@/lib/theme'
import { Results } from './results'

type Result = { ok: boolean; input: string; revealed: boolean }

export function Study({ song, user, onBack }: { song: Song; user: User; onBack: () => void }) {
  const { progress } = useStore()
  const prog = progress[song.id] ?? {}
  const L = song.lines
  const total = L.length
  const [current, setCurrent] = useState(() => {
    const first = L.findIndex((_, k) => !prog[k]?.ok)
    return first < 0 ? 0 : first
  })
  const [answer, setAnswer] = useState('')
  const [translation, setTranslation] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [repeat, setRepeat] = useState(false)
  const [speed, setSpeed] = useState('1')
  const [showResults, setShowResults] = useState(false)
  const [scores, setScores] = useState<Score[]>([])
  const [saveError, setSaveError] = useState('')
  const drafts = useRef<Record<number, { answer: string; translation: string }>>({})
  const answerRef = useRef<HTMLTextAreaElement>(null)
  const koRef = useRef<HTMLInputElement>(null)
  const [needKo, setNeedKo] = useState(false)
  const yt = useYouTube(song.youtubeId)
  const hue = useSongHue(song)

  useEffect(() => watchScores(song.id, setScores), [song.id])

  useEffect(() => {
    if (yt.ready) yt.setRate(Number(speed))
  }, [speed, yt.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  if (total === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <BackButton onClick={onBack} />
        <p className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">이 곡에는 아직 문장이 없어요.</p>
      </main>
    )
  }

  const attempted = (k: number) => !!(prog[k]?.tries || prog[k]?.revealed)
  const allDone = L.every((_, k) => attempted(k))
  const firstUndone = Math.max(0, L.findIndex((_, k) => !attempted(k)))
  const openResults = () => {
    drafts.current[current] = { answer, translation }
    yt.stop()
    setShowResults(true)
    window.scrollTo(0, 0)
  }

  if (showResults) {
    return (
      <Results
        song={song}
        progress={prog}
        onBack={onBack}
        onReview={(k) => {
          const d = drafts.current[k]
          setAnswer(d?.answer ?? '')
          setTranslation(d?.translation ?? '')
          setResult(null)
          setCurrent(k)
          setShowResults(false)
          window.scrollTo(0, 0)
        }}
        onRestart={() => {
          actions.saveProgress(song.id, {}).catch(() => {})
          drafts.current = {}
          setAnswer('')
          setTranslation('')
          setResult(null)
          setCurrent(0)
          setShowResults(false)
        }}
      />
    )
  }

  const sentence = L[current]
  const p = prog[current] ?? {}
  const okCount = countCorrect(prog, total)
  const endOf = (k: number) => L.slice(k + 1).find((l) => l.start != null)?.start ?? yt.duration ?? (L[k].start ?? 0) + 8
  const canPlay = !!song.youtubeId && yt.ready && sentence.start != null

  const save = (next: typeof prog) => {
    setSaveError('')
    actions.saveProgress(song.id, next).catch(() => setSaveError('기록을 저장하지 못했어요. 인터넷 연결을 확인해 주세요.'))
  }

  const move = (k: number) => {
    if (k < 0 || k >= total) return
    drafts.current[current] = { answer, translation }
    yt.stop()
    const d = drafts.current[k]
    setAnswer(d?.answer ?? '')
    setTranslation(d?.translation ?? '')
    setResult(null)
    setNeedKo(false)
    setCurrent(k)
  }

  const submit = () => {
    const input = answer.trim()
    if (!input) {
      answerRef.current?.focus()
      return
    }
    if (!translation.trim()) {
      setNeedKo(true)
      koRef.current?.focus()
      return
    }
    const ok = input === baseText(sentence.ruby).trim()
    save({ ...prog, [current]: { ...p, ok: !!(p.ok || ok), last: ok, tries: (p.tries ?? 0) + 1, answer: input, translation: translation.trim() } })
    setResult({ ok, input, revealed: false })
  }
  const reveal = () => {
    save({ ...prog, [current]: { ...p, revealed: true, answer: p.answer ?? answer.trim(), translation: translation.trim() || p.translation } })
    setResult({ ok: false, input: answer.trim(), revealed: true })
  }
  const retry = () => {
    setResult(null)
    setTimeout(() => answerRef.current?.focus(), 0)
  }

  return (
    <main className="study-page song-theme mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10" style={themeStyle(hue)}>
      <BackButton onClick={onBack} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-lg">
            {song.youtubeId ? (
              <div ref={yt.hostRef} className="absolute inset-0 [&_iframe]:size-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-400">
                <span className="text-sm">유튜브 링크가 없는 곡이에요</span>
                <span className="text-xs text-slate-500">관리자가 곡 편집에서 링크를 넣으면 구간 듣기가 켜져요.</span>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => (yt.segActive ? yt.stop() : yt.playSegment(sentence.start, endOf(current), repeat))}
              disabled={!canPlay}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {yt.segActive ? <><Pause className="size-4" />멈추기</> : <><Headphones className="size-4" />구간 듣기</>}
            </button>
            {song.youtubeId && sentence.start == null && <span className="text-xs text-amber-600 dark:text-amber-400">이 문장은 아직 타이밍이 없어요</span>}
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={repeat} onChange={(e) => { setRepeat(e.target.checked); yt.setLoop(e.target.checked) }} className="accent-primary" />반복
            </label>
            <select value={speed} onChange={(e) => setSpeed(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-2 text-sm" aria-label="재생 속도">
              <option value="1">1배속</option>
              <option value="0.75">0.75배속</option>
              <option value="0.5">0.5배속</option>
            </select>
          </div>

          <div className="mt-8 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-widest text-primary"><span className="font-jp">{song.title}</span></p>
              <h1 className="mt-2 text-2xl font-bold">문장 {current + 1} <span className="font-normal text-muted-foreground">/ {total} · 정답 {okCount}</span></h1>
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">시도 {p.tries ?? 0}회</span>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <label htmlFor="jp-answer" className="text-sm font-semibold">일본어 받아쓰기 <span className="font-normal text-destructive">*</span></label>
              {result && !result.revealed && <span className={result.ok ? 'stamp stamp-ok' : 'stamp stamp-no'}>{result.ok ? '〇 정답' : '✕ 오답'}</span>}
            </div>
            <div className={`relative ${result && !result.revealed ? (result.ok ? 'answer-ok' : 'answer-no stamp-shake') : ''}`} key={`wrap-${current}-${p.tries ?? 0}`}>
            {result && !result.revealed && (
              <span className={`hanko ${result.ok ? 'hanko-ok' : 'hanko-no'}`} role="img" aria-label={result.ok ? '정답 도장' : '오답 도장'}>
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle className="hanko-rim" cx="50" cy="50" r="45" />
                  {result.ok ? (
                    <circle className="hanko-mark" cx="50" cy="50" r="24" pathLength={1} />
                  ) : (
                    <>
                      <path className="hanko-mark" d="M32 32 L68 68" pathLength={1} />
                      <path className="hanko-mark hanko-mark-2" d="M68 32 L32 68" pathLength={1} />
                    </>
                  )}
                </svg>
                <span className="hanko-label">{result.ok ? '正解' : '不正解'}</span>
              </span>
            )}
            <textarea
              id="jp-answer"
              ref={answerRef}
              lang="ja"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault()
                  if (!result) submit()
                }
              }}
              disabled={!!result}
              placeholder="들은 문장을 일본어로 적어 보세요"
              className="jp-writing min-h-28 w-full resize-none rounded-xl border-2 border-dashed border-border bg-background p-4 pr-28 text-lg outline-none focus:border-primary disabled:opacity-80"
            />
            </div>
            <label htmlFor="ko-answer" className="mt-5 block text-sm font-semibold">한국어 해석 <span className="font-normal text-destructive">*</span></label>
            <input
              id="ko-answer"
              ref={koRef}
              value={translation}
              onChange={(e) => { setTranslation(e.target.value); if (e.target.value.trim()) setNeedKo(false) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault()
                  if (!result) submit()
                }
              }}
              placeholder="문장의 뜻을 적어 보세요"
              aria-invalid={needKo}
              required
              className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive"
              disabled={!!result}
            />
            {needKo && !result && <p className="mt-2 text-xs text-destructive">한국어 해석까지 적어야 채점할 수 있어요.</p>}

            {saveError && <p className="mt-3 text-xs text-destructive">{saveError}</p>}
            {result && (
              <div className="mt-5 rounded-xl bg-muted/60 p-4 text-sm">
                {!result.revealed ? (
                  <>
                    <p className="font-semibold">{result.ok ? '잘했어요! 한 글자도 틀리지 않았어요.' : '조금 달라요. 빨간 부분을 살펴볼까요?'}</p>
                    {!result.ok && <DiffView answer={baseText(sentence.ruby)} input={result.input} />}
                  </>
                ) : (
                  <p className="font-semibold">정답을 확인해 보세요.</p>
                )}
                <p className="mt-4 text-xs font-semibold text-muted-foreground">정답</p>
                <p className="mt-1 font-jp text-xl leading-loose"><Furigana text={sentence.ruby} /></p>
                <p className="mt-4 text-sm font-semibold text-muted-foreground">원래 해석</p>
                <p className="mt-1 text-base leading-7">{sentence.ko || <span className="text-muted-foreground">해석 없음</span>}</p>
                {translation.trim() && (
                  <>
                    <p className="mt-3 text-sm font-semibold text-muted-foreground">내 해석</p>
                    <p className="mt-1 text-base leading-7">{translation.trim()}</p>
                  </>
                )}
              </div>
            )}

            {!result ? (
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button className="h-12 w-full text-base sm:h-10 sm:w-auto sm:flex-1 sm:text-sm" onClick={submit} disabled={!answer.trim() || !translation.trim()}>채점하기 <Check data-icon="inline-end" /></Button>
                <button onClick={reveal} className="h-11 rounded-lg px-4 text-sm text-muted-foreground hover:bg-muted sm:h-10">모르겠어요 · 정답 보기</button>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {!result.ok && <Button variant="outline" className="h-12 w-full text-base sm:h-10 sm:w-auto sm:text-sm" onClick={retry}><RotateCcw data-icon="inline-start" />다시 풀기</Button>}
                {current === total - 1 && allDone ? (
                  <Button className="h-12 w-full text-base sm:h-10 sm:w-auto sm:flex-1 sm:text-sm" onClick={openResults}><Trophy data-icon="inline-start" />결과 보기</Button>
                ) : current === total - 1 ? (
                  <Button className="h-12 w-full text-base sm:h-10 sm:w-auto sm:flex-1 sm:text-sm" onClick={() => move(firstUndone)}>안 푼 문장으로<ChevronRight data-icon="inline-end" /></Button>
                ) : (
                  <Button className="h-12 w-full text-base sm:h-10 sm:w-auto sm:flex-1 sm:text-sm" onClick={() => move(current + 1)}>다음 문장<ChevronRight data-icon="inline-end" /></Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between">
            <button onClick={() => move(current - 1)} disabled={current === 0} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"><ChevronLeft className="size-4" />이전 문장</button>
            <button onClick={() => move(current + 1)} disabled={current === total - 1} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40">건너뛰기<ChevronRight className="size-4" /></button>
          </div>
        </section>

        <aside className="min-w-0">
          {allDone && (
            <Button onClick={openResults} className="mb-4 h-11 w-full"><Trophy data-icon="inline-start" />결과 보기</Button>
          )}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">문장 목록</h2>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
              {L.map((_, i) => {
                const st = prog[i]
                const tone = i === current
                  ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                  : st?.ok
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
                    : st?.tries || st?.revealed
                      ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/60'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted hover:text-foreground'
                return (
                  <button key={i} onClick={() => move(i)} className={`grid aspect-square place-items-center rounded-lg border text-sm font-semibold transition hover:-translate-y-px ${tone}`} aria-label={`${i + 1}번 문장`} aria-current={i === current}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-emerald-500" />정답</span>
              <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-red-500" />오답</span>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">친구들 기록</h2>
              <Users className="size-4 text-muted-foreground" />
            </div>
            {(() => {
              // 내 기록은 항상 최신 값으로, 친구들은 정답 많은 순
              const others = scores.filter((sc) => sc.uid !== user.uid)
              const list = [{ uid: user.uid, name: user.name, ok: okCount, total }, ...others].sort((a, b) => b.ok - a.ok)
              return (
                <div className="flex flex-col gap-4">
                  {list.map((sc) => (
                    <div key={sc.uid}>
                      <div className="mb-1 flex justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate">{sc.name}{sc.uid === user.uid && <span className="ml-1 text-primary">(나)</span>}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">{sc.ok} / {sc.total || total}</span>
                      </div>
                      <ProgressBar value={((sc.ok) / (sc.total || total)) * 100} />
                    </div>
                  ))}
                  {others.length === 0 && <p className="text-xs leading-5 text-muted-foreground">아직 이 곡을 푼 친구가 없어요.</p>}
                </div>
              )
            })()}
          </div>
        </aside>
      </div>
    </main>
  )
}

function DiffView({ answer, input }: { answer: string; input: string }) {
  const d = diffChars(answer, input)
  const draw = (arr: DiffChar[], bad: string) =>
    arr.map((x, k) =>
      x.bad ? (
        <span key={k} className={`${bad} ${/\s/.test(x.c) ? 'outline outline-1 outline-dashed outline-destructive' : ''}`}>{/\s/.test(x.c) ? ' ' : x.c}</span>
      ) : (
        <span key={k}>{x.c}</span>
      ),
    )
  return (
    <div className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 font-jp text-base">
      <span className="font-sans text-xs leading-7 text-muted-foreground">내 답</span>
      <span lang="ja" className="break-all leading-7">{input ? draw(d.inp, 'text-destructive line-through') : <span className="font-sans text-muted-foreground">(비어 있음)</span>}</span>
      <span className="font-sans text-xs leading-7 text-muted-foreground">빠진 글자</span>
      <span lang="ja" className="break-all leading-7">{draw(d.ans, 'rounded-sm bg-destructive/15 text-destructive underline decoration-wavy underline-offset-4')}</span>
    </div>
  )
}
