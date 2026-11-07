'use client'

import { useEffect, useRef, useState } from 'react'
import { AppLogo } from './logo'
import { Hanko } from './blank-card'

const SEEN_KEY = 'kakitori.tutorial.v1'

/** 처음 들어온 사람에게 한 번만 보여 줄지 */
export function shouldShowTutorial() {
  try {
    return !window.localStorage.getItem(SEEN_KEY)
  } catch {
    return false
  }
}
function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1')
  } catch {}
}

const Chip = ({ c, children }: { c: string; children: React.ReactNode }) => <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${c}`}>{children}</span>
const Mini = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs ${className}`}>{children}</div>
)

/** 일정 시간마다 0 → 1 → … → n-1 → 0 으로 넘어가는 장면 번호 */
function usePhase(n: number, ms: number) {
  const [p, setP] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setP((x) => (x + 1) % n), ms)
    return () => window.clearInterval(t)
  }, [n, ms])
  return p
}
/** 조금 있다가 true (도장을 늦게 찍을 때) */
function useLater(ms: number) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setOn(true), ms)
    return () => window.clearTimeout(t)
  }, [ms])
  return on
}

/* 1장: 로고 + 헤드폰 옆에서 통통 튀는 음표 */
const NOTES = [
  { c: '♪', at: 'left-[-22%] top-[30%] text-2xl sm:text-4xl', d: '0s' },
  { c: '♫', at: 'right-[-26%] top-[22%] text-3xl sm:text-5xl', d: '.35s' },
  { c: '♬', at: 'left-[-34%] top-[62%] text-xl sm:text-3xl', d: '.8s' },
  { c: '♪', at: 'right-[-30%] top-[66%] text-xl sm:text-3xl', d: '1.15s' },
  { c: '♩', at: 'left-[8%] top-[-18%] text-lg sm:text-2xl', d: '.6s' },
]
function WelcomeArt() {
  return (
    <div className="relative">
      <AppLogo className="relative z-[1] size-24 sm:size-36" />
      {NOTES.map((n, k) => (
        <span key={k} aria-hidden className={`tut-note absolute font-bold text-[#f2b84b] ${n.at}`} style={{ animationDelay: n.d }}>{n.c}</span>
      ))}
    </div>
  )
}

/* 2장: 난이도 목록 → 쉬움 → 보통 → 어려움 화면이 차례로 */
const LEVEL = {
  easy: { name: '쉬움', c: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', what: '보기 4개 중에 고르기' },
  normal: { name: '보통', c: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', what: '빈칸만 직접 쓰기' },
  hard: { name: '어려움', c: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', what: '문장 전체 받아쓰기' },
} as const
const Level = ({ k }: { k: keyof typeof LEVEL }) => (
  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-sm">
    <Chip c={LEVEL[k].c}>{LEVEL[k].name}</Chip>{LEVEL[k].what}
  </div>
)
/** 한 글자씩 써지는 글자 */
function Typing({ text, delay = 0.3, dur = 1.2 }: { text: string; delay?: number; dur?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(text.length)
    let t = 0
    const start = window.setTimeout(() => {
      t = window.setInterval(() => setN((x) => (x >= text.length ? x : x + 1)), (dur * 1000) / text.length)
    }, delay * 1000)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(t)
    }
  }, [text, delay, dur])
  return <span className="whitespace-nowrap">{text.slice(0, n)}</span>
}
function LevelsArt() {
  const p = usePhase(4, 2800)
  return (
    <div className="w-[88%] sm:w-[78%]">
      <div key={p} className="tut-slide">
        {p === 0 && (
          <div className="flex flex-col gap-1.5 sm:gap-2.5 sm:[&>div]:py-2.5 sm:[&>div]:text-sm">
            {(['easy', 'normal', 'hard'] as const).map((k) => (
              <Mini key={k}><Chip c={LEVEL[k].c}>{LEVEL[k].name}</Chip> {LEVEL[k].what}</Mini>
            ))}
          </div>
        )}
        {p === 1 && (
          <div>
            <Level k="easy" />
            <Mini className="mt-1.5 py-2 text-center font-jp text-base sm:mt-2.5 sm:py-3 sm:text-2xl">
              夜空に<span className="mx-1 inline-block min-w-[1.6em] border-b-2 border-primary text-primary"><span className="tut-fill">光</span></span>が咲いた
            </Mini>
            <div className="mt-1.5 grid grid-cols-4 gap-1 font-jp text-sm sm:mt-2.5 sm:gap-2 sm:text-lg">
              {['星', '光', '花', '夢'].map((c) => (
                <span key={c} className={`rounded-lg border py-1 text-center sm:py-1.5 ${c === '光' ? 'tut-pick border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>{c}</span>
              ))}
            </div>
          </div>
        )}
        {p === 2 && (
          <div>
            <Level k="normal" />
            <Mini className="mt-1.5 py-2.5 text-center font-jp text-base sm:mt-2.5 sm:py-4 sm:text-2xl">
              夜空に光が
              <span className="ml-1 inline-flex min-w-[3.4em] items-center rounded-md border border-primary/60 bg-background px-1 text-left">
                <Typing text="咲いた" />
                <span className="tut-caret" />
              </span>
            </Mini>
          </div>
        )}
        {p === 3 && (
          <div>
            <Level k="hard" />
            <div className="mt-1.5 flex min-h-[2.4em] items-center rounded-lg border-2 border-dashed border-primary/50 bg-card px-2.5 font-jp text-base sm:mt-2.5 sm:px-4 sm:text-2xl">
              <Typing text="夜空に光が咲いた" dur={1.6} />
              <span className="tut-caret" />
            </div>
            <Mini className="tut-fill-late mt-1.5 sm:mt-2.5 sm:py-2.5 sm:text-sm">밤하늘에 빛이 피었다</Mini>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-center gap-1 sm:mt-3" aria-hidden>
        {[0, 1, 2, 3].map((k) => <span key={k} className={`h-1 rounded-full transition-all ${k === p ? 'w-3 bg-primary/70' : 'w-1 bg-foreground/15'}`} />)}
      </div>
    </div>
  )
}

/* 3장: 정답이면 〇 도장, 오답이면 틀린 곳에 줄 긋고 ✕ 도장 */
function GradeOk() {
  const stamp = useLater(550)
  return (
    <div className="tut-stamp tut-stamp-low relative">
      <div className="rounded-lg bg-primary py-1 text-center text-[11px] font-bold text-primary-foreground sm:py-2 sm:text-sm">🎧 1번 문장 듣기</div>
      <Mini className="mt-1.5 py-2 pr-16 font-jp text-base sm:mt-2.5 sm:py-3 sm:text-2xl">夜空に光が咲いた</Mini>
      <Mini className="mt-1.5 sm:mt-2.5 sm:py-2.5 sm:text-sm">밤하늘에 빛이 피었다</Mini>
      {stamp && <Hanko ok />}
    </div>
  )
}
function GradeNo() {
  const stamp = useLater(1100)
  return (
    <div className="tut-stamp relative">
      <Mini className="py-2 pr-16 font-jp text-base sm:py-3 sm:text-2xl">
        <span className="mr-1.5 font-sans text-[10px] text-muted-foreground sm:text-xs">내 답</span>夜空に<span className="tut-strike text-destructive">星</span>が咲いた
      </Mini>
      <Mini className="mt-1.5 py-2 pr-16 font-jp text-base sm:mt-2.5 sm:py-3 sm:text-2xl">
        <span className="mr-1.5 font-sans text-[10px] text-muted-foreground sm:text-xs">정답</span>夜空に<span className="tut-fill-mid rounded-sm bg-destructive/15 text-destructive underline decoration-wavy underline-offset-4">光</span>が咲いた
      </Mini>
      {stamp && <Hanko ok={false} />}
    </div>
  )
}
function GradeArt() {
  const p = usePhase(2, 3200)
  return (
    <div className="w-[85%] sm:w-[75%]">
      <div key={p} className="tut-slide">{p === 0 ? <GradeOk /> : <GradeNo />}</div>
    </div>
  )
}

const STEPS: { title: string; body: React.ReactNode; art: React.ReactNode; dark?: boolean }[] = [
  {
    title: '카키토리 노트에 오신 걸 환영해요',
    body: <>좋아하는 J-POP을 <b>한 문장씩 듣고, 받아 적고, 해석하면서</b> 일본어를 공부하는 곳이에요. 1분만 둘러볼까요?</>,
    art: <WelcomeArt />,
    dark: true,
  },
  {
    title: '곡과 난이도를 골라요',
    body: <>곡 목록에서 노래를 고르고 난이도를 정해요. 처음이면 <b>쉬움</b>부터 시작해 보세요. 기록은 난이도마다 따로 저장돼요.</>,
    art: <LevelsArt />,
  },
  {
    title: '듣고, 쓰고, 채점해요',
    body: <><b>문장 듣기</b>로 그 부분만 들어요. 반복·배속도 돼요. 일본어와 한국어 해석을 적고 채점하면 〇✕ 도장이 찍혀요.</>,
    art: <GradeArt />,
  },
  {
    title: '풀이 보고 복습해요',
    body: <>채점 뒤 <b>문장 풀이</b>로 단어와 문법을 확인해요. 틀린 문장은 <b>오답 노트</b>에 모이고, 가나가 처음이면 <b>단어장</b>부터!</>,
    art: (
      <div className="grid w-[88%] grid-cols-2 gap-1.5 sm:w-[80%] sm:gap-2.5 sm:[&>div]:py-3 sm:[&>div]:text-sm">
        <Mini>📖 문장 풀이<span className="block text-muted-foreground">단어·문법</span></Mini>
        <Mini>🎵 결과 화면<span className="block text-muted-foreground">노래 들으며 확인</span></Mini>
        <Mini>📝 오답 노트<span className="block text-muted-foreground">틀린 문장 다시</span></Mini>
        <Mini>あ 단어장<span className="block text-muted-foreground">가나·노래 단어</span></Mini>
      </div>
    ),
  },
]

/** 사용법 안내 (카드 4장, 모달) */
export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const touch = useRef<number | null>(null)
  const last = i === STEPS.length - 1
  const s = STEPS[i]

  const close = () => {
    markSeen()
    onClose()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') setI((x) => Math.min(STEPS.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="사용법 안내"
        className="hint-pop w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl sm:max-w-xl sm:p-8"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          if (dx < -50) setI((x) => Math.min(STEPS.length - 1, x + 1))
          if (dx > 50) setI((x) => Math.max(0, x - 1))
        }}
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">{i + 1} / {STEPS.length}</span>
          {!last && <button onClick={close} className="rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground">건너뛰기</button>}
        </div>
        <div key={i} className="hint-pop">
          <div className={`mt-3 grid h-44 place-items-center overflow-hidden rounded-2xl sm:mt-5 sm:h-64 ${s.dark ? 'bg-[#2f3a56]' : 'bg-muted/60'}`}>{s.art}</div>
          <h2 className="mt-4 text-lg font-bold leading-snug sm:mt-6 sm:text-2xl">{s.title}</h2>
          <p className="mt-1.5 min-h-[4.5rem] text-sm leading-6 text-muted-foreground sm:mt-2 sm:min-h-[5.5rem] sm:text-base sm:leading-7 [&_b]:text-foreground">{s.body}</p>
        </div>
        <div className="my-4 flex justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, k) => (
            <button key={k} tabIndex={-1} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="h-12 flex-1 rounded-xl border border-border text-sm hover:bg-muted sm:h-13 sm:text-base">이전</button>
          )}
          <button
            autoFocus
            onClick={() => (last ? close() : setI(i + 1))}
            className="h-12 flex-1 rounded-xl bg-primary text-sm font-semibold sm:h-13 sm:text-base text-primary-foreground transition hover:bg-primary/90"
          >
            {i === 0 ? '시작하기' : last ? '공부 시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
