'use client'

import { useEffect, useRef, useState } from 'react'
import { Trophy, X } from 'lucide-react'
import { countCorrectIn, progKey, useStore } from '@/lib/store'
import { gradedLines } from '@/lib/blanks'
import { isTimed } from '@/lib/wrong'
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty, type Song, type SongProgress } from '@/lib/types'

/** 난이도별 완주 도장: 쉬움 易(초록) · 보통 普(주황) · 어려움 難(빨강) */
export const STAMP: Record<Difficulty, { ch: string; on: string; big: string }> = {
  easy: {
    ch: '易',
    on: 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300',
    big: 'border-emerald-600 text-emerald-700 bg-emerald-50 shadow-emerald-600/30 dark:border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/60',
  },
  normal: {
    ch: '普',
    on: 'border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-300',
    big: 'border-amber-600 text-amber-700 bg-amber-50 shadow-amber-600/30 dark:border-amber-400 dark:text-amber-300 dark:bg-amber-950/60',
  },
  hard: {
    ch: '難',
    on: 'border-red-600 text-red-700 dark:border-red-400 dark:text-red-300',
    big: 'border-red-600 text-red-700 bg-red-50 shadow-red-600/30 dark:border-red-400 dark:text-red-300 dark:bg-red-950/60',
  },
}

/** 이 곡·난이도를 다 맞혔는지 (게이지가 꽉 찼는지) */
export function isComplete(song: Song, d: Difficulty, p: SongProgress | undefined) {
  const lines = gradedLines(song, d)
  return lines.length > 0 && countCorrectIn(p, lines) === lines.length
}

/** 작은 도장 하나. onPhoto: 곡 사진 위에 올릴 때(빈 도장을 흰 점선으로) */
export function Stamp({ d, on, onPhoto = false, className = '' }: { d: Difficulty; on: boolean; onPhoto?: boolean; className?: string }) {
  const s = STAMP[d]
  const label = `${DIFFICULTY_LABEL[d]} ${on ? '완주' : '아직'}`
  if (!on)
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={`grid shrink-0 place-items-center rounded-full border-2 border-dashed font-jp font-extrabold ${onPhoto ? 'border-white/70 bg-black/20 text-white/70' : 'border-muted-foreground/30 text-muted-foreground/40'} ${className}`}
      >
        {s.ch}
      </span>
    )
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`grid shrink-0 -rotate-12 place-items-center rounded-full border-[2.5px] bg-[#fffaf0] font-jp font-extrabold shadow-md dark:bg-card ${s.on} ${className}`}
    >
      {s.ch}
    </span>
  )
}

/**
 * 공부 화면에 붙여 두면, 그 난이도를 막 다 맞힌 순간 '완주' 창을 띄워요.
 * 들어올 때부터 이미 완주였던 곡은 띄우지 않아요.
 */
export function CompletionWatcher({ song, d, onNext, onBook }: { song: Song; d: Difficulty; onNext: (d: Difficulty) => void; onBook: () => void }) {
  const { progress, ready } = useStore()
  const done = isComplete(song, d, progress[progKey(song.id, d)])
  const was = useRef<boolean | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!ready) return // 기록을 다 불러온 뒤부터 지켜봐요
    if (was.current === false && done) setOpen(true)
    was.current = done
  }, [done, ready])
  if (!open) return null
  const n = gradedLines(song, d).length
  const next = DIFFICULTIES[DIFFICULTIES.indexOf(d) + 1]
  const close = () => setOpen(false)
  return (
    <Overlay onClose={close} label="완주">
      <div className="text-center">
        <div style={{ transform: 'rotate(-10deg)' }} className={`stamp-slam mx-auto mt-2 grid size-36 place-items-center rounded-full border-[6px] shadow-lg sm:size-40 ${STAMP[d].big}`}>
          <div>
            <div className="font-jp text-4xl font-black leading-none sm:text-[2.6rem]">完走</div>
            <div className="mt-1.5 text-sm font-bold">{DIFFICULTY_LABEL[d]}</div>
          </div>
        </div>
        <h2 className="mt-6 text-xl font-bold">
          <span lang="ja" className="font-jp">{song.title}</span> {DIFFICULTY_LABEL[d]} 완주!
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {n}문장을 모두 맞혔어요.<br />곡 카드에 <b className={STAMP[d].on.split(' ').filter((c) => c.includes('text-')).join(' ')}>{STAMP[d].ch}</b> 도장이 찍혔어요.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {next && (
            <button onClick={() => { close(); onNext(next) }} className="h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              {DIFFICULTY_LABEL[next]} 도전하기
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={() => { close(); onBook() }} className={`h-11 flex-1 rounded-xl text-sm ${next ? 'border border-border hover:bg-muted' : 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90'}`}>📒 도장 수첩 보기</button>
            <button onClick={close} className="h-11 flex-1 rounded-xl border border-border text-sm hover:bg-muted">닫기</button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}

/** 도장 수첩: 곡마다 받은 도장을 모아 봐요. 곡을 누르면 그 곡으로 */
export function StampBook({ isAdmin, onClose, onOpen }: { isAdmin: boolean; onClose: () => void; onOpen: (id: string) => void }) {
  const { songs, progress } = useStore()
  const list = [...songs]
    .filter((s) => isTimed(s) || isAdmin)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((song) => ({ song, got: DIFFICULTIES.map((d) => isComplete(song, d, progress[progKey(song.id, d)])) }))
  const have = list.reduce((n, x) => n + x.got.filter(Boolean).length, 0)
  const all = list.length * DIFFICULTIES.length
  const trophies = list.filter((x) => x.got.every(Boolean)).length
  return (
    <Overlay onClose={onClose} label="도장 수첩" wide>
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">📒 도장 수첩</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold tabular-nums text-amber-800 dark:bg-amber-950 dark:text-amber-300">{have} / {all}</span>
        <button onClick={onClose} className="ml-auto grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="닫기"><X className="size-4" /></button>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        난이도마다 게이지를 꽉 채우면 도장을 받아요. 세 개를 다 모은 곡은 🏆{trophies > 0 && <> · 지금 <b className="text-foreground">{trophies}곡</b></>}
      </p>
      <div className="mt-3 flex items-center justify-end gap-3 text-[11px] text-muted-foreground">
        {DIFFICULTIES.map((d) => <span key={d} className="flex w-8 justify-center whitespace-nowrap sm:w-9">{DIFFICULTY_LABEL[d]}</span>)}
      </div>
      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">아직 풀 수 있는 곡이 없어요.</p>
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {list.map(({ song, got }) => (
            <li key={song.id}>
              <button onClick={() => onOpen(song.id)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                  <span lang="ja" className="flex items-center gap-1.5 font-jp text-sm font-semibold">
                    <span className="truncate">{song.title}</span>
                    {got.every(Boolean) && <Trophy className="size-4 shrink-0 text-amber-500" aria-label="도장 3개" />}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{song.artist}</span>
                </span>
                {DIFFICULTIES.map((d, k) => <Stamp key={d} d={d} on={got[k]} className="size-8 text-sm sm:size-9 sm:text-base" />)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Overlay>
  )
}

function Overlay({ onClose, label, wide = false, children }: { onClose: () => void; label: string; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 py-6 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={label} className={`hint-pop max-h-full w-full overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7 ${wide ? 'max-w-lg' : 'max-w-sm sm:max-w-md'}`}>
        {children}
      </div>
    </div>
  )
}
