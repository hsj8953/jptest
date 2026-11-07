'use client'

// 숨은 테스트 페이지: 브라우저 음성 인식(일본어)이 얼마나 잘 알아듣는지 확인해요.
// 로그인 없이 열리고, 녹음·결과는 어디에도 저장하지 않아요.
import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { diffChars } from '@/lib/diff'

type Alt = { text: string; conf: number }
type Try = { target: string; alts: Alt[]; at: number }

// 브라우저마다 이름이 달라요 (크롬·사파리는 webkit 접두사)
type Rec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
const getRec = (): (new () => Rec) | null => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Rec) | null
}

const SAMPLES = ['夜空に光が咲いた', '君の声が聞こえる', '明日もきっと会える', 'ありがとう、また会おうね']
const strip = (s: string) => s.replace(/[\s　、。，．！？!?,.・「」『』〜~ー]/g, '')

const ERR: Record<string, string> = {
  'not-allowed': '마이크 권한이 막혀 있어요. 주소창 옆 자물쇠 아이콘에서 마이크를 허용해 주세요.',
  'no-speech': '소리가 안 들렸어요. 마이크에 조금 더 가까이 말해 보세요.',
  'audio-capture': '마이크를 찾지 못했어요.',
  network: '인식 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요.',
  'language-not-supported': '이 브라우저는 일본어 인식을 지원하지 않아요.',
}

export default function SpeechTest() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [target, setTarget] = useState(SAMPLES[0])
  const [live, setLive] = useState('')
  const [on, setOn] = useState(false)
  const [err, setErr] = useState('')
  const [tries, setTries] = useState<Try[]>([])
  const recRef = useRef<Rec | null>(null)
  const gotRef = useRef<Alt[] | null>(null)

  const [ua, setUa] = useState('')
  useEffect(() => {
    setSupported(!!getRec())
    setUa(navigator.userAgent)
  }, [])

  const start = () => {
    const R = getRec()
    if (!R) return
    setErr('')
    setLive('')
    gotRef.current = null
    const r = new R()
    r.lang = 'ja-JP'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 3
    const goal = target
    r.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setLive(text)
      const last = e.results[e.results.length - 1]
      if (last.isFinal) {
        const alts: Alt[] = []
        for (let k = 0; k < last.length; k++) alts.push({ text: last[k].transcript, conf: last[k].confidence })
        gotRef.current = alts
      }
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted') setErr(ERR[e.error] ?? `오류: ${e.error}`)
    }
    r.onend = () => {
      setOn(false)
      const alts = gotRef.current
      if (alts?.length) setTries((t) => [{ target: goal, alts, at: Date.now() }, ...t].slice(0, 30))
    }
    recRef.current = r
    try {
      r.start()
      setOn(true)
    } catch {
      setErr('인식을 시작하지 못했어요. 잠시 후 다시 눌러 주세요.')
    }
  }
  const stop = () => recRef.current?.stop()

  const matched = tries.filter((t) => t.target && strip(t.alts[0].text) === strip(t.target)).length
  const withTarget = tries.filter((t) => t.target).length

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary">TEST</p>
      <h1 className="mt-1 text-2xl font-bold">일본어 음성 인식 테스트</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        브라우저에 들어 있는 음성 인식이 일본어를 얼마나 잘 알아듣는지 확인하는 페이지예요. 노래하지 말고 <b className="text-foreground">말하듯이</b> 읽어 주세요. 결과는 이 화면에만 보이고 저장되지 않아요.
      </p>

      {supported === false && (
        <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
          이 브라우저는 음성 인식을 지원하지 않아요. 안드로이드·PC는 <b>크롬</b>, 아이폰은 <b>사파리</b>로 열어 보세요.
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <label className="text-xs font-semibold text-muted-foreground" htmlFor="target">읽을 문장 (비워 두면 인식 결과만 봐요)</label>
        <input id="target" lang="ja" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-input bg-background px-3 font-jp text-lg outline-none focus:ring-2 focus:ring-ring" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SAMPLES.map((s) => (
            <button key={s} onClick={() => setTarget(s)} className={`rounded-full border px-2.5 py-1 font-jp text-xs ${s === target ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>{s}</button>
          ))}
        </div>

        <button
          onClick={on ? stop : start}
          disabled={!supported}
          className={`mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition disabled:opacity-40 ${on ? 'bg-rose-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
        >
          {on ? <><Square className="size-4 fill-current" />듣는 중… 누르면 멈춰요</> : <><Mic className="size-5" />누르고 말하기</>}
        </button>
        <p lang="ja" className="mt-3 min-h-8 text-center font-jp text-xl">{live || <span className="text-sm text-muted-foreground">{on ? '말해 보세요' : ' '}</span>}</p>
        {err && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      </section>

      {tries.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">결과 <span className="font-normal text-muted-foreground">· 최근 {tries.length}번</span></h2>
            {withTarget > 0 && <span className="text-sm">글자까지 똑같이 인식: <b className="tabular-nums">{matched} / {withTarget}</b></span>}
          </div>
          <ul className="flex flex-col gap-2">
            {tries.map((t) => {
              const best = t.alts[0]
              const d = t.target ? diffChars(strip(t.target), strip(best.text)) : null
              const same = t.target && strip(best.text) === strip(t.target)
              return (
                <li key={t.at} className="rounded-2xl border border-border bg-card p-3.5">
                  {t.target && <p lang="ja" className="font-jp text-sm text-muted-foreground">읽은 문장: {t.target}</p>}
                  <p lang="ja" className="mt-1 font-jp text-xl leading-8">
                    {d ? d.inp.map((c, i) => <span key={i} className={c.bad ? 'rounded-sm bg-destructive/15 text-destructive' : 'text-emerald-700 dark:text-emerald-400'}>{c.c}</span>) : best.text}
                    {same && <span className="ml-2 align-middle text-sm">✅</span>}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    확신도 {best.conf ? `${Math.round(best.conf * 100)}%` : '알 수 없음'}
                    {t.alts.length > 1 && <> · 다른 후보: <span lang="ja" className="font-jp">{t.alts.slice(1).map((a) => a.text).join(' / ')}</span></>}
                  </p>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">빨간 글자는 읽은 문장과 다르게 받아 적은 부분이에요. 한자를 히라가나로 적은 것도 지금은 다르게 표시돼요(읽기 비교는 본 기능에서).</p>
        </section>
      )}

      <p className="mt-8 break-all text-[11px] text-muted-foreground/70">{ua}</p>
    </main>
  )
}
