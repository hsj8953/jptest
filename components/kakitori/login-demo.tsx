'use client'

import { useEffect, useState } from 'react'

// 로그인 화면 시연용 문장 (직접 지은 짧은 문장)
const DEMO = [
  { jp: '今日も一緒に歌おう', ko: '오늘도 함께 노래하자' },
  { jp: '夜空に小さな光が咲いた', ko: '밤하늘에 작은 빛이 피어났어' },
  { jp: '風の音を書き留めよう', ko: '바람 소리를 적어 두자' },
  { jp: '一文字ずつ心に刻む', ko: '한 글자씩 마음에 새겨' },
]

type Phase = 'typing' | 'stamp' | 'hold' | 'clear'

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/** 원고지 칸에 문장이 한 글자씩 쓰이고 〇 도장이 찍히는 시연 */
export function DictationDemo() {
  const reduced = useReducedMotion()
  const [idx, setIdx] = useState(0)
  const [len, setLen] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')
  const line = DEMO[idx]
  const chars = Array.from(line.jp)

  useEffect(() => {
    if (reduced) return
    let t: number
    if (phase === 'typing') {
      if (len < chars.length) t = window.setTimeout(() => setLen((n) => n + 1), 140 + Math.random() * 90)
      else t = window.setTimeout(() => setPhase('stamp'), 350)
    } else if (phase === 'stamp') t = window.setTimeout(() => setPhase('hold'), 900)
    else if (phase === 'hold') t = window.setTimeout(() => setPhase('clear'), 1300)
    else
      t = window.setTimeout(() => {
        setIdx((i) => (i + 1) % DEMO.length)
        setLen(0)
        setPhase('typing')
      }, 450)
    return () => window.clearTimeout(t)
  }, [phase, len, chars.length, reduced])

  const shown = reduced ? chars.length : len
  const stamped = reduced || phase === 'stamp' || phase === 'hold'

  return (
    <div className={`login-demo relative rounded-2xl border border-border bg-card/90 p-4 text-left shadow-xl backdrop-blur ${phase === 'clear' && !reduced ? 'is-clearing' : ''}`}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
          <span className="login-eq" aria-hidden><i /><i /><i /><i /></span>
          구간 듣기
        </span>
        <span>문장 {idx + 1}</span>
      </div>
      <div className="login-sheet relative min-h-[4.5rem] rounded-xl border-2 border-dashed border-border bg-background px-3 py-3 pr-20" aria-hidden>
        <span className="font-jp text-xl leading-8 tracking-wide">
          {chars.slice(0, shown).map((c, i) => (
            <span key={`${idx}-${i}`} className="login-char">{c}</span>
          ))}
          {!reduced && phase === 'typing' && <span className="login-caret" />}
        </span>
        {stamped && (
          <span className="hanko hanko-ok login-hanko" key={`stamp-${idx}`}>
            <svg viewBox="0 0 100 100">
              <circle className="hanko-rim" cx="50" cy="50" r="45" />
              <circle className="hanko-mark" cx="50" cy="50" r="24" pathLength={1} />
            </svg>
          </span>
        )}
      </div>
      <p className={`mt-2 min-h-5 text-sm text-muted-foreground transition-opacity duration-300 ${stamped ? 'opacity-100' : 'opacity-0'}`}>{line.ko}</p>
      <span className="sr-only">노래를 듣고 일본어로 받아쓰면 바로 채점해 주는 화면 예시</span>
    </div>
  )
}

// 배경에 떠다니는 글자 (위치·속도는 고정값이라 매번 같아요)
const FLOAT = [
  { c: '音', x: 6, s: 2.6, d: 19, delay: -2 },
  { c: 'あ', x: 16, s: 1.6, d: 23, delay: -11 },
  { c: '歌', x: 27, s: 3.2, d: 27, delay: -6 },
  { c: 'き', x: 38, s: 1.8, d: 21, delay: -15 },
  { c: '書', x: 50, s: 2.4, d: 25, delay: -3 },
  { c: 'の', x: 61, s: 1.5, d: 18, delay: -9 },
  { c: '声', x: 70, s: 2.9, d: 29, delay: -18 },
  { c: 'と', x: 80, s: 1.7, d: 20, delay: -5 },
  { c: '詞', x: 89, s: 2.5, d: 24, delay: -13 },
  { c: 'り', x: 95, s: 1.6, d: 22, delay: -20 },
  { c: '聴', x: 44, s: 2, d: 31, delay: -24 },
  { c: 'ら', x: 10, s: 2.1, d: 26, delay: -17 },
]

export function FloatingKana() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {FLOAT.map((f, i) => (
        <span
          key={i}
          className="login-float font-jp"
          style={{ left: `${f.x}%`, fontSize: `${f.s}rem`, animationDuration: `${f.d}s`, animationDelay: `${f.delay}s` } as React.CSSProperties}
        >
          {f.c}
        </span>
      ))}
    </div>
  )
}
