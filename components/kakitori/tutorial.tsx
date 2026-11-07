'use client'

import { useEffect, useRef, useState } from 'react'
import { AppLogo } from './logo'

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

const STEPS: { title: string; body: React.ReactNode; art: React.ReactNode; dark?: boolean }[] = [
  {
    title: '카키토리 노트에 오신 걸 환영해요',
    body: <>좋아하는 J-POP을 <b>한 문장씩 듣고, 받아 적고, 해석하면서</b> 일본어를 공부하는 곳이에요. 1분만 둘러볼까요?</>,
    art: <AppLogo className="size-24 sm:size-36" />,
    dark: true,
  },
  {
    title: '곡과 난이도를 골라요',
    body: <>곡 목록에서 노래를 고르고 난이도를 정해요. 처음이면 <b>쉬움</b>부터 시작해 보세요. 기록은 난이도마다 따로 저장돼요.</>,
    art: (
      <div className="flex w-[85%] flex-col gap-1.5 sm:w-[75%] sm:gap-2.5 sm:[&>div]:py-2.5 sm:[&>div]:text-sm">
        <Mini><Chip c="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">쉬움</Chip> 보기 4개 중에 고르기</Mini>
        <Mini><Chip c="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">보통</Chip> 빈칸만 직접 쓰기</Mini>
        <Mini><Chip c="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">어려움</Chip> 문장 전체 받아쓰기</Mini>
      </div>
    ),
  },
  {
    title: '듣고, 쓰고, 채점해요',
    body: <><b>문장 듣기</b>로 그 부분만 들어요. 반복·배속도 돼요. 일본어와 한국어 해석을 적고 채점하면 〇✕ 도장이 찍혀요.</>,
    art: (
      <div className="w-[85%] sm:w-[75%] sm:[&>div]:mt-2.5 sm:[&>div]:py-2.5 sm:[&>div]:text-sm">
        <div className="rounded-lg bg-primary py-1.5 text-center text-xs font-bold text-primary-foreground">🎧 1번 문장 듣기</div>
        <Mini className="relative mt-1.5 font-jp text-base" >
          夜空に光が咲いた
          <span className="absolute right-2 top-1/2 size-6 -translate-y-1/2 rounded-full border-[3px] border-emerald-600" aria-hidden />
        </Mini>
        <Mini className="mt-1.5">밤하늘에 빛이 피었다</Mini>
      </div>
    ),
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
          <div className={`mt-3 grid h-36 place-items-center rounded-2xl sm:mt-5 sm:h-60 ${s.dark ? 'bg-[#2f3a56]' : 'bg-muted/60'}`}>{s.art}</div>
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
