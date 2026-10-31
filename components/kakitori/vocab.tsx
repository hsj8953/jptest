'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronRight, Eye, Layers, ListChecks, RotateCcw, Table2, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actions, useStore } from '@/lib/store'
import { HIRAGANA, KATAKANA, cellsOf, type KanaCell, type KanaGroup } from '@/lib/kana'
import { canSpeak, hasJapaneseVoice, speak, wordKey } from '@/lib/words'
import { getVolume, loadVoiceConfig, setVolume, warmUpAudio } from '@/lib/voice'
import { VoicePanel } from './voice-panel'
import type { Song } from '@/lib/types'

type Tab = 'hira' | 'kata' | 'words'
const MASTER = 3 // 숙련도 3 이상이면 '외움'
const MAX = 5

const shuffle = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
/** 숙련도가 낮을수록 자주 나오게 고르기 */
function pickWeighted<T>(items: T[], level: (x: T) => number, avoid?: T): T {
  const pool = items.length > 1 && avoid ? items.filter((x) => x !== avoid) : items
  const weights = pool.map((x) => 1 / (1 + level(x)) ** 1.5)
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}
const up = (lv: number) => Math.min(MAX, lv + 1)
const down = (lv: number) => Math.max(0, lv - 2)

function Dots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`숙련도 ${level} / ${MAX}`}>
      {Array.from({ length: MAX }, (_, i) => (
        <i key={i} className={`size-1.5 rounded-full ${i < level ? (level >= MASTER ? 'bg-emerald-500' : 'bg-primary') : 'bg-muted-foreground/25'}`} />
      ))}
    </span>
  )
}

function SpeakButton({ text, className = '' }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false)
  useEffect(() => setOk(canSpeak()), [])
  if (!ok) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        speak(text)
      }}
      className={`grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground ${className}`}
      aria-label={`${text} 발음 듣기`}
    >
      <Volume2 className="size-4" />
    </button>
  )
}

/** VOICEVOX 음성 출처 (사용 조건) — 음성이 없으면 기기 음성 안내 */
function VoiceCredit() {
  const [credit, setCredit] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    loadVoiceConfig().then((c) => setCredit(c?.credit ?? null))
  }, [])
  return (
    <>
      {credit === null && <NoVoiceNotice />}
      <div className="mb-3 flex items-center justify-end gap-3 text-[11px] text-muted-foreground">
        <VolumeControl />
        {credit && <span>음성: {credit}</span>}
      </div>
    </>
  )
}

/** 발음 볼륨 (이 기기에만 저장) */
function VolumeControl() {
  const [v, setV] = useState(0.6)
  useEffect(() => setV(getVolume()), [])
  return (
    <label className="inline-flex items-center gap-1.5">
      <Volume2 className="size-3.5" />
      <span className="sr-only">발음 볼륨</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={v}
        onChange={(e) => {
          const n = Number(e.target.value)
          setV(n)
          setVolume(n)
        }}
        onPointerUp={() => speak('あ')}
        onKeyUp={() => speak('あ')}
        className="h-1 w-24 accent-primary"
        aria-label="발음 볼륨"
      />
      <span className="w-7 tabular-nums">{Math.round(v * 100)}%</span>
    </label>
  )
}

/** 기기에 일본어 음성이 없으면 안내해요 (없으면 한국어 음성이 일본어를 엉터리로 읽어요) */
function NoVoiceNotice() {
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    if (!canSpeak()) return
    const check = () => setMissing(hasJapaneseVoice() === false)
    check()
    window.speechSynthesis.addEventListener('voiceschanged', check)
    const t = setTimeout(check, 1500)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', check)
      clearTimeout(t)
    }
  }, [])
  if (!missing) return null
  return (
    <p className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      이 기기에는 일본어 음성이 없어서 발음이 어색하게 들릴 수 있어요. 윈도우는 <b>설정 → 시간 및 언어 → 음성 → 음성 추가</b>에서 <b>일본어</b>를 설치한 뒤 브라우저를 다시 켜 주세요.
    </p>
  )
}

/** 답을 본 뒤 발음을 다시 듣는 버튼 */
function ListenAgain({ text, rate, className = '' }: { text: string; rate?: number; className?: string }) {
  return (
    <Button type="button" variant="outline" className={`h-12 text-base ${className}`} onClick={(e) => { e.stopPropagation(); speak(text, rate) }}>
      <Volume2 data-icon="inline-start" />발음 다시 듣기
    </Button>
  )
}

function Segmented<T extends string>({ value, onChange, items, small }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; icon?: React.ReactNode }[]; small?: boolean }) {
  return (
    <div className="inline-flex rounded-xl bg-muted p-1" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`inline-flex ${small ? 'h-8 px-2.5' : 'h-9 px-3'} items-center gap-1.5 rounded-lg text-sm font-medium transition ${value === it.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Vocab({ onBack, onGoLine, initialTab, isAdmin = false }: { onBack: () => void; onGoLine: (songId: string, line: number) => void; initialTab?: Tab; isAdmin?: boolean }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'hira')
  return (
    <main className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-10" onPointerDown={warmUpAudio}>
      <button onClick={onBack} className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />곡 목록
      </button>
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-6 sm:items-end sm:gap-4">
        <div>
          <p className="mb-1 hidden text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:block">単語帳</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">단어장</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">가나부터 노래에 나온 한자 단어까지 익혀 보세요.</p>
        </div>
        <Segmented
          small
          value={tab}
          onChange={setTab}
          items={[
            { id: 'hira', label: 'ひらがな' },
            { id: 'kata', label: 'カタカナ' },
            { id: 'words', label: '노래 단어' },
          ]}
        />
      </div>
      {isAdmin && <VoicePanel />}
      <VoiceCredit />
      {tab === 'hira' && <KanaTab key="hira" groups={HIRAGANA} name="히라가나" />}
      {tab === 'kata' && <KanaTab key="kata" groups={KATAKANA} name="가타카나" />}
      {tab === 'words' && <WordsTab onGoLine={onGoLine} />}
    </main>
  )
}

/* ── 히라가나 · 가타카나 ─────────────────────────── */

function KanaTab({ groups, name }: { groups: KanaGroup[]; name: string }) {
  const { vocab } = useStore()
  const [mode, setMode] = useState<'table' | 'quiz'>('table')
  const [active, setActive] = useState<string | null>(null)
  const [group, setGroup] = useState<KanaGroup['id']>('basic')
  const all = useMemo(() => cellsOf(groups), [groups])
  const mastered = all.filter((k) => (vocab.kana[k.kana] ?? 0) >= MASTER).length

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <Segmented
          small
          value={mode}
          onChange={setMode}
          items={[
            { id: 'table', label: '표', icon: <Table2 className="size-4" /> },
            { id: 'quiz', label: '퀴즈', icon: <ListChecks className="size-4" /> },
          ]}
        />
        <span className="text-sm text-muted-foreground">
          외운 {name} <b className="text-foreground tabular-nums">{mastered}</b> / {all.length}
        </span>
      </div>

      {mode === 'table' ? (
        <div>
          <div className="mb-2.5 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="글자 묶음">
            {groups.map((g) => {
              const cells = cellsOf([g])
              const done = cells.filter((k) => (vocab.kana[k.kana] ?? 0) >= MASTER).length
              return (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={group === g.id}
                  onClick={() => setGroup(g.id)}
                  className={`h-8 shrink-0 rounded-full border px-3 text-sm font-medium transition ${group === g.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
                >
                  {g.title.replace(' (기본)', '')}
                  <span className={`ml-1.5 text-xs tabular-nums ${group === g.id ? 'opacity-80' : 'opacity-60'}`}>{done}/{cells.length}</span>
                </button>
              )
            })}
          </div>
          {groups
            .filter((g) => g.id === group)
            .map((g) => (
              <div key={g.id} className={`grid gap-1 sm:gap-1.5 ${g.cols === 6 ? 'grid-cols-6' : g.cols === 5 ? 'grid-cols-5' : 'grid-cols-3'} max-w-xl`}>
                {g.rows.flat().map((cell, i) =>
                  cell ? (
                    <KanaButton
                      key={i}
                      cell={cell}
                      level={vocab.kana[cell.kana] ?? 0}
                      active={active === cell.kana}
                      onClick={() => {
                        setActive(cell.kana)
                        speak(cell.kana, 0.8)
                      }}
                    />
                  ) : (
                    <span key={i} aria-hidden />
                  ),
                )}
              </div>
            ))}
          <p className="mt-3 hidden text-xs text-muted-foreground sm:block">글자를 누르면 발음을 들려줘요. 퀴즈에서 여러 번 맞힌 글자는 초록색으로 바뀌어요.</p>
        </div>
      ) : (
        <KanaQuiz groups={groups} />
      )}
    </section>
  )
}

function KanaButton({ cell, level, active, onClick }: { cell: NonNullable<KanaCell>; level: number; active: boolean; onClick: () => void }) {
  const done = level >= MASTER
  return (
    <button
      onClick={onClick}
      className={`flex h-11 flex-col items-center justify-center rounded-xl border transition hover:-translate-y-px hover:shadow-md sm:h-16 ${
        active ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : done ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-border bg-card hover:border-primary/40'
      }`}
      aria-label={`${cell.kana} ${cell.romaji}`}
    >
      <span lang="ja" className={`font-jp leading-none ${cell.kana.length > 1 ? 'text-lg' : 'text-xl'} sm:text-2xl`}>{cell.kana}</span>
      <span className="mt-0.5 text-[10px] leading-none text-muted-foreground sm:text-[11px]">{cell.romaji}</span>
    </button>
  )
}

function KanaQuiz({ groups }: { groups: KanaGroup[] }) {
  const { vocab } = useStore()
  const [sets, setSets] = useState<Record<string, boolean>>({ basic: true, voiced: false, combo: false })
  const pool = useMemo(() => cellsOf(groups.filter((g) => sets[g.id])), [groups, sets])
  const [q, setQ] = useState<NonNullable<KanaCell> | null>(null)
  const [choices, setChoices] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })

  const next = (prev?: NonNullable<KanaCell>) => {
    if (!pool.length) return setQ(null)
    const item = pickWeighted(pool, (x) => vocab.kana[x.kana] ?? 0, prev)
    const others = shuffle([...new Set(pool.map((x) => x.romaji).filter((r) => r !== item.romaji))]).slice(0, 3)
    setQ(item)
    setChoices(shuffle([item.romaji, ...others]))
    setPicked(null)
  }
  useEffect(() => {
    next()
  }, [pool]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (r: string) => {
    if (!q || picked) return
    setPicked(r)
    const ok = r === q.romaji
    const lv = vocab.kana[q.kana] ?? 0
    actions.saveVocab({ kana: { [q.kana]: ok ? up(lv) : down(lv) } }).catch(() => {})
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }))
    speak(q.kana, 0.8)
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => setSets((s) => ({ ...s, [g.id]: !s[g.id] || Object.values(s).filter(Boolean).length === 1 ? true : false }))}
            className={`h-8 rounded-full border px-3 text-xs font-medium transition ${sets[g.id] ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40'}`}
            aria-pressed={!!sets[g.id]}
          >
            {g.title}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{score.right} / {score.total}</span>
      </div>

      {q && (
        <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="flex justify-end"><Dots level={vocab.kana[q.kana] ?? 0} /></div>
          <p lang="ja" className="font-jp text-7xl leading-tight">{q.kana}</p>
          <p className="mt-2 text-sm text-muted-foreground">이 글자는 어떻게 읽을까요?</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {choices.map((r) => {
              const state = !picked ? '' : r === q.romaji ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : r === picked ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'opacity-50'
              return (
                <button key={r} onClick={() => answer(r)} disabled={!!picked} className={`h-14 rounded-xl border border-border text-lg font-semibold transition ${picked ? '' : 'hover:border-primary/50 hover:bg-muted'} ${state}`}>
                  {r}
                </button>
              )
            })}
          </div>
          {picked && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <ListenAgain text={q.kana} rate={0.8} />
              <Button className="h-12 text-base" onClick={() => next(q)}>
                다음 글자<ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 노래 단어 ─────────────────────────────── */

type VWord = { key: string; word: string; reading: string; meaning: string; songs: { id: string; title: string; lines: number[] }[] }

function collectWords(songs: Song[]): VWord[] {
  const map = new Map<string, VWord>()
  for (const s of songs) {
    for (const w of s.words ?? []) {
      if (!w.word) continue
      const key = wordKey(w)
      const got = map.get(key)
      if (got) {
        if (!got.meaning && w.meaning) got.meaning = w.meaning
        got.songs.push({ id: s.id, title: s.title, lines: w.lines })
      } else map.set(key, { key, word: w.word, reading: w.reading, meaning: w.meaning, songs: [{ id: s.id, title: s.title, lines: w.lines }] })
    }
  }
  return [...map.values()]
}

function WordsTab({ onGoLine }: { onGoLine: (songId: string, line: number) => void }) {
  const { songs, vocab, ready } = useStore()
  const all = useMemo(() => collectWords(songs), [songs])
  const songsWithWords = songs.filter((s) => s.words?.length)
  const [songFilter, setSongFilter] = useState<string>('all')
  const [status, setStatus] = useState<'all' | 'todo' | 'done'>('all')
  const [mode, setMode] = useState<'list' | 'card' | 'quiz'>('list')

  const lv = (w: VWord) => vocab.words[w.key] ?? 0
  const filtered = all.filter(
    (w) => (songFilter === 'all' || w.songs.some((s) => s.id === songFilter)) && (status === 'all' || (status === 'done' ? lv(w) >= MASTER : lv(w) < MASTER)),
  )
  const mastered = all.filter((w) => lv(w) >= MASTER).length

  if (ready && !all.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm leading-6 text-muted-foreground">
        <BookOpen className="mx-auto mb-3 size-8 opacity-60" />
        아직 단어장이 만들어진 곡이 없어요.
        <br />
        관리자가 곡 편집 화면에서 <b className="text-foreground">단어장 만들기</b>를 누르면 여기에 단어가 모여요.
      </div>
    )
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={mode}
          onChange={setMode}
          items={[
            { id: 'list', label: '목록', icon: <Table2 className="size-4" /> },
            { id: 'card', label: '카드', icon: <Layers className="size-4" /> },
            { id: 'quiz', label: '퀴즈', icon: <ListChecks className="size-4" /> },
          ]}
        />
        <span className="text-sm text-muted-foreground">
          외운 단어 <b className="text-foreground tabular-nums">{mastered}</b> / {all.length}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <select value={songFilter} onChange={(e) => setSongFilter(e.target.value)} className="h-10 min-w-0 max-w-full rounded-xl border border-border bg-background px-3 text-sm" aria-label="곡 고르기">
          <option value="all">모든 곡 ({all.length})</option>
          {songsWithWords.map((s) => (
            <option key={s.id} value={s.id}>{s.title} ({s.words?.length ?? 0})</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm" aria-label="외운 단어 걸러 보기">
          <option value="all">전체</option>
          <option value="todo">아직 못 외운 단어</option>
          <option value="done">외운 단어</option>
        </select>
      </div>

      {!filtered.length ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {status === 'todo' ? '이 조건의 단어를 전부 외웠어요!' : '해당하는 단어가 없어요.'}
        </p>
      ) : mode === 'list' ? (
        <WordList words={filtered} level={lv} onGoLine={onGoLine} />
      ) : mode === 'card' ? (
        <WordCards key={`${songFilter}-${status}`} words={filtered} level={lv} onGoLine={onGoLine} />
      ) : (
        <WordQuiz key={`${songFilter}-${status}`} words={filtered} pool={all} level={lv} onGoLine={onGoLine} />
      )}
    </section>
  )
}

function SongChips({ w, onGoLine }: { w: VWord; onGoLine: (songId: string, line: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {w.songs.map((s) => (
        <button
          key={s.id}
          onClick={() => s.lines.length && onGoLine(s.id, s.lines[0])}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          title="이 단어가 나온 문장으로 가기"
        >
          <span className="truncate font-jp">{s.title}</span>
          {s.lines.length > 0 && <span className="shrink-0 tabular-nums">· {s.lines[0] + 1}번 문장</span>}
          <ChevronRight className="size-3 shrink-0" />
        </button>
      ))}
    </div>
  )
}

function WordList({ words, level, onGoLine }: { words: VWord[]; level: (w: VWord) => number; onGoLine: (songId: string, line: number) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {words.map((w) => {
        const lv = level(w)
        const done = lv >= MASTER
        return (
          <article key={w.key} className={`flex flex-col gap-3 rounded-2xl border bg-card p-4 ${done ? 'border-emerald-300/70 dark:border-emerald-800/70' : 'border-border'}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <ruby lang="ja" className="font-jp text-2xl font-semibold">
                  {w.word}
                  <rt className="text-[0.45em] font-normal text-muted-foreground">{w.reading}</rt>
                </ruby>
                <p className="mt-1 text-sm">{w.meaning || <span className="text-muted-foreground">뜻 없음</span>}</p>
              </div>
              <SpeakButton text={w.reading || w.word} />
              <button
                onClick={() => actions.saveVocab({ words: { [w.key]: done ? 0 : MASTER } }).catch(() => {})}
                className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition ${done ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                aria-pressed={done}
              >
                <Check className="size-3.5" />외웠어요
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <SongChips w={w} onGoLine={onGoLine} />
              <Dots level={lv} />
            </div>
          </article>
        )
      })}
    </div>
  )
}

function WordCards({ words, level, onGoLine }: { words: VWord[]; level: (w: VWord) => number; onGoLine: (songId: string, line: number) => void }) {
  // 못 외운 단어가 앞에 오도록 섞어요
  const [deck] = useState(() => shuffle(words).sort((a, b) => level(a) - level(b)))
  const [i, setI] = useState(0)
  const [flip, setFlip] = useState(false)
  const w = deck[i]

  const rate = (knew: boolean) => {
    const lv = level(w)
    actions.saveVocab({ words: { [w.key]: knew ? up(lv) : down(lv) } }).catch(() => {})
    setFlip(false)
    setI((n) => n + 1)
  }

  if (!w) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-lg font-semibold">카드를 다 넘겼어요</p>
        <p className="mt-1 text-sm text-muted-foreground">{deck.length}개 단어를 한 번씩 봤어요.</p>
        <Button className="mt-5 h-11" onClick={() => setI(0)}><RotateCcw data-icon="inline-start" />처음부터 다시</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{i + 1} / {deck.length}</span>
        <Dots level={level(w)} />
      </div>
      <button
        onClick={() => {
          if (!flip) speak(w.reading || w.word)
          setFlip((f) => !f)
        }}
        className="flex min-h-72 w-full flex-col items-center justify-center rounded-3xl border border-border bg-card p-6 text-center shadow-sm transition hover:shadow-md"
        aria-label={flip ? '앞면 보기' : '뜻 보기'}
      >
        <span lang="ja" className="font-jp text-5xl font-semibold leading-tight">{w.word}</span>
        {flip ? (
          <span className="hint-pop mt-5 flex flex-col items-center gap-2">
            <span lang="ja" className="font-jp text-xl text-primary">{w.reading}</span>
            <span className="text-lg">{w.meaning || '뜻 없음'}</span>
          </span>
        ) : (
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Eye className="size-4" />눌러서 읽기·뜻 보고 발음 듣기</span>
        )}
      </button>
      {flip && (
        <div className="hint-pop mt-3 flex flex-col gap-2">
          <ListenAgain text={w.reading || w.word} className="w-full" />
          <SongChips w={w} onGoLine={onGoLine} />
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12 text-base" onClick={() => rate(false)}>아직이에요</Button>
        <Button className="h-12 text-base" onClick={() => rate(true)}>외웠어요</Button>
      </div>
    </div>
  )
}

function WordQuiz({ words, pool, level, onGoLine }: { words: VWord[]; pool: VWord[]; level: (w: VWord) => number; onGoLine: (songId: string, line: number) => void }) {
  const [kind, setKind] = useState<'meaning' | 'reading'>('meaning')
  const [q, setQ] = useState<VWord | null>(null)
  const [choices, setChoices] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const field = (w: VWord) => (kind === 'meaning' ? w.meaning : w.reading)
  const usable = pool.filter((w) => field(w))
  const enough = new Set(usable.map(field)).size >= 4

  const next = (prev?: VWord) => {
    const cand = words.filter((w) => field(w))
    if (!cand.length || !enough) return setQ(null)
    const item = pickWeighted(cand, level, prev)
    const others = shuffle([...new Set(usable.map(field).filter((v) => v !== field(item)))]).slice(0, 3)
    setQ(item)
    setChoices(shuffle([field(item), ...others]))
    setPicked(null)
  }
  useEffect(() => {
    next()
  }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (v: string) => {
    if (!q || picked) return
    setPicked(v)
    const ok = v === field(q)
    const lv = level(q)
    actions.saveVocab({ words: { [q.key]: ok ? up(lv) : down(lv) } }).catch(() => {})
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }))
    speak(q.reading || q.word)
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-2">
        <Segmented
          value={kind}
          onChange={setKind}
          items={[
            { id: 'meaning', label: '뜻 맞히기' },
            { id: 'reading', label: '읽기 맞히기' },
          ]}
        />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{score.right} / {score.total}</span>
      </div>
      {!enough ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">퀴즈를 하려면 {kind === 'meaning' ? '뜻' : '읽기'}이 있는 단어가 4개 이상 필요해요.</p>
      ) : q ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="flex justify-end"><Dots level={level(q)} /></div>
          <p lang="ja" className="font-jp text-5xl font-semibold leading-tight">{q.word}</p>
          <p className="mt-2 truncate text-xs text-muted-foreground">♪ <span className="font-jp">{q.songs.map((x) => x.title).join(' · ')}</span></p>
          <p className="mt-2 text-sm text-muted-foreground">{kind === 'meaning' ? '이 단어의 뜻은?' : '이 단어는 어떻게 읽을까요?'}</p>
          <div className="mt-6 grid gap-2">
            {choices.map((v) => {
              const state = !picked ? '' : v === field(q) ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : v === picked ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'opacity-50'
              return (
                <button key={v} onClick={() => answer(v)} disabled={!!picked} className={`min-h-12 rounded-xl border border-border px-3 py-2 text-base transition ${picked ? '' : 'hover:border-primary/50 hover:bg-muted'} ${kind === 'reading' ? 'font-jp' : ''} ${state}`}>
                  {v}
                </button>
              )
            })}
          </div>
          {picked && (
            <>
              <p className="mt-4 text-sm text-muted-foreground">
                <span lang="ja" className="font-jp text-foreground">{q.word}</span> · <span lang="ja" className="font-jp">{q.reading}</span> · {q.meaning}
              </p>
              <div className="mt-3 flex justify-center"><SongChips w={q} onGoLine={onGoLine} /></div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ListenAgain text={q.reading || q.word} />
                <Button className="h-12 text-base" onClick={() => next(q)}>
                  다음 단어<ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
