'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Mic, Pause, Play, Square } from 'lucide-react'
import { canRecord, compareSpeech, getRecognizer, loadKanjiDict, SPEECH_ERR, type KanjiDict, type Recognizer } from '@/lib/speech'
import type { Song } from '@/lib/types'
import { Furigana } from './furigana'

type Said = { text: string; conf: number; alts: string[] }

/**
 * 채점한 뒤 보이는 '따라 말하기' (실험 기능)
 * - 말하기: 브라우저 음성 인식으로 받아 적고, 원문과 소리(읽기)로 비교해요
 * - 녹음: 내 목소리를 녹음해서 들어 봐요 (인식이 안 되는 브라우저에서도 돼요)
 * 기록·채점에는 아무 영향이 없고, 아무것도 저장하지 않아요.
 */
export function ShadowPanel({ song, lineIndex }: { song: Song; lineIndex: number }) {
  const line = song.lines[lineIndex]
  const [open, setOpen] = useState(false)
  const [support, setSupport] = useState({ rec: false, mic: false })
  useEffect(() => setSupport({ rec: !!getRecognizer(), mic: canRecord() }), [])
  if (!line || (!support.rec && !support.mic)) return null
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
      >
        <Mic className="size-4" />
        {open ? '따라 말하기 접기' : '따라 말하기'}
        <span className="rounded-md bg-rose-200/70 px-1.5 py-px text-[10px] font-bold text-rose-800 dark:bg-rose-500/25 dark:text-rose-200">실험</span>
        <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <ShadowBody song={song} ruby={line.ruby} rec={support.rec} mic={support.mic} />}
    </div>
  )
}

function ShadowBody({ song, ruby, rec, mic }: { song: Song; ruby: string; rec: boolean; mic: boolean }) {
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState('')
  const [said, setSaid] = useState<Said | null>(null)
  const [err, setErr] = useState('')
  const recRef = useRef<Recognizer | null>(null)
  const gotRef = useRef<Said | null>(null)

  // 곡에 없는 한자의 읽기 사전 (처음 펼칠 때 한 번만 받아요)
  const [dict, setDict] = useState<KanjiDict | undefined>()
  useEffect(() => {
    let alive = true
    loadKanjiDict().then((d) => alive && setDict(d))
    return () => {
      alive = false
      recRef.current?.abort() // 화면을 떠나면 마이크를 꺼요
    }
  }, [])

  const speak = () => {
    const R = getRecognizer()
    if (!R) return
    setErr('')
    setLive('')
    setSaid(null)
    gotRef.current = null
    const r = new R()
    r.lang = 'ja-JP'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 5
    r.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setLive(text)
      const last = e.results[e.results.length - 1]
      if (last.isFinal) {
        // 앞부분(이미 확정된 결과) + 마지막 결과의 후보들
        const head = text.slice(0, text.length - last[0].transcript.length)
        const alts: string[] = []
        for (let k = 0; k < last.length; k++) alts.push(head + last[k].transcript)
        gotRef.current = { text, conf: last[0].confidence, alts }
      }
    }
    let lastText = ''
    let failed = false
    const onres = r.onresult
    r.onresult = (e) => {
      onres?.(e)
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      lastText = t
    }
    r.onerror = (e) => {
      if (e.error === 'aborted') return
      failed = true
      setErr(SPEECH_ERR[e.error] ?? `음성 인식 오류: ${e.error}`)
    }
    r.onend = () => {
      setListening(false)
      if (gotRef.current) setSaid(gotRef.current)
      // 일부 안드로이드 크롬은 '확정' 신호 없이 끝나요. 들린 글자가 있으면 그걸로 채점해요
      else if (lastText.trim()) setSaid({ text: lastText, conf: 0, alts: [lastText] })
      // 오류도 결과도 없이 끝나면 아무 반응이 없는 것처럼 보여서, 왜 그런지 알려 줘요
      else if (!failed) setErr('아무 소리도 인식하지 못했어요. 다른 앱(카카오톡 통화, 디스코드 등)이 마이크를 쓰고 있지 않은지, 크롬 설정에서 맞는 마이크가 선택돼 있는지 확인해 주세요.')
    }
    recRef.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      setErr('인식을 시작하지 못했어요. 잠시 후 다시 눌러 주세요.')
    }
  }

  // 인식기가 준 후보 문장 중 원문과 가장 잘 맞는 걸로 봐요
  const cmp = said
    ? said.alts
        .map((t) => ({ t, r: compareSpeech(song, ruby, t, dict) }))
        .reduce((a, b) => (b.r.score > a.r.score ? b : a))
    : null
  const res = cmp?.r ?? null
  const best = cmp?.t ?? ''
  const tone = !res ? '' : res.score >= 90 ? 'good' : res.score >= 60 ? 'mid' : 'low'

  return (
    <div className="hint-pop mt-3 rounded-2xl border border-border bg-card p-4 text-left">
      <p className="text-xs leading-5 text-muted-foreground">위의 <b className="text-foreground">문장 듣기</b>로 듣고, 노래하지 말고 <b className="text-foreground">말하듯이</b> 따라 말해 보세요. 채점·기록에는 들어가지 않아요.</p>
      <p className="mt-3 text-center font-jp text-xl leading-[2.4] sm:text-2xl"><Furigana text={ruby} /></p>

      {rec ? (
        <>
          <button
            type="button"
            onClick={listening ? () => recRef.current?.stop() : speak}
            className={`mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${listening ? 'bg-rose-600 text-white ring-4 ring-rose-300/60 dark:ring-rose-500/30' : 'bg-rose-600/90 text-white hover:bg-rose-600'}`}
          >
            {listening ? <><Square className="size-3.5 fill-current" />듣는 중… 다 말하면 자동으로 멈춰요</> : <><Mic className="size-4" />{said ? '다시 말하기' : '눌러서 따라 말하기'}</>}
          </button>
          {listening && <p lang="ja" className="mt-3 min-h-8 text-center font-jp text-lg">{live || <span className="font-sans text-sm text-muted-foreground">말해 보세요</span>}</p>}
          {err && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

          {res && said && !listening && (
            <div className="hint-pop mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <b className="shrink-0 text-sm">일치 {res.score}%</b>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className={`block h-full rounded-full transition-all ${tone === 'good' ? 'bg-emerald-500' : tone === 'mid' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${res.score}%` }} />
                </span>
                <span className="shrink-0 text-sm font-semibold">{tone === 'good' ? '아주 좋아요!' : tone === 'mid' ? '거의 다 왔어요' : '한 번 더!'}</span>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground">내가 말한 것 (알아들은 글자)</p>
                <p lang="ja" className="mt-0.5 font-jp text-lg">{markHomophones(best, res.homophones.map((h) => h.said))}</p>
                {res.homophones.map((h) => (
                  <p key={h.said} className="mt-1 text-xs leading-5 text-muted-foreground">
                    💡 <span lang="ja" className="font-jp font-semibold text-foreground">{h.said}</span>(<span lang="ja" className="font-jp">{h.read}</span>)라고 알아들었어요. 원문 한자 <span lang="ja" className="font-jp font-semibold text-foreground">{h.orig}</span>도 소리가 같아서 정답이에요.
                  </p>
                ))}
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground">소리로 비교 <span className="font-normal">· 위: 원문 소리 / 아래: 내 소리</span></p>
                <p lang="ja" className="mt-1 break-all font-jp text-base leading-7">
                  {res.ans.map((c, i) => <span key={i} className={c.bad ? 'rounded-sm bg-amber-200/70 text-amber-900 underline decoration-wavy underline-offset-4 dark:bg-amber-500/25 dark:text-amber-200' : ''}>{c.c}</span>)}
                </p>
                <p lang="ja" className="break-all font-jp text-base leading-7">
                  {res.inp.map((c, i) => <span key={i} className={c.bad ? 'rounded-sm bg-destructive/15 text-destructive' : 'text-emerald-700 dark:text-emerald-400'}>{c.c}</span>)}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">노란 글자는 덜 들린 소리, 빨간 글자는 다르게 들린 소리예요. 한자·히라가나 차이나, 소리가 같은 다른 한자(鐘·金 등)는 상관없어요.</p>
                <p className="mt-1 text-[10px] text-muted-foreground/70">한자 읽기: KANJIDIC2 © EDRDG (CC BY-SA 4.0)</p>
              </div>
              {said.conf > 0 && said.conf < 0.6 && <p className="text-xs text-muted-foreground">💡 인식기가 조금 헷갈려 했어요. 조금 더 또렷하게, 마이크 가까이에서 말해 보세요.</p>}
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">이 브라우저는 음성 인식을 지원하지 않아서 녹음만 할 수 있어요. 따라 말하기 비교는 크롬(안드로이드·PC)이나 사파리(아이폰)에서 돼요.</p>
      )}

      {mic && <Recorder />}
    </div>
  )
}

/** 소리가 같은 다른 한자로 알아들은 곳에 점선 밑줄 */
function markHomophones(text: string, words: string[]) {
  if (!words.length) return text
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`)
  return text.split(re).map((part, i) =>
    words.includes(part) ? <span key={i} className="text-muted-foreground underline decoration-dotted decoration-2 underline-offset-4" title="소리가 같은 다른 한자">{part}</span> : part,
  )
}

/** 내 목소리 녹음해서 듣기 (저장하지 않아요) */
function Recorder() {
  const [state, setState] = useState<'idle' | 'rec' | 'done'>('idle')
  const [url, setUrl] = useState('')
  const [playing, setPlaying] = useState(false)
  const [err, setErr] = useState('')
  const mr = useRef<MediaRecorder | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const timer = useRef(0)

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (mr.current?.state === 'recording') mr.current.stop()
      audio.current?.pause()
    },
    [],
  )
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const start = async () => {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        window.clearTimeout(timer.current)
        setUrl(URL.createObjectURL(new Blob(chunks, { type: r.mimeType || 'audio/webm' })))
        setState('done')
      }
      mr.current = r
      r.start()
      setState('rec')
      timer.current = window.setTimeout(() => r.state === 'recording' && r.stop(), 20000) // 최대 20초
    } catch {
      setErr('마이크를 쓸 수 없어요. 마이크 권한을 허용해 주세요.')
    }
  }
  const play = () => {
    if (!url) return
    if (playing) {
      audio.current?.pause()
      return
    }
    const a = audio.current ?? new Audio()
    audio.current = a
    a.src = url
    a.onended = () => setPlaying(false)
    a.onpause = () => setPlaying(false)
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-[11px] font-semibold text-muted-foreground">내 목소리 녹음해서 원곡과 비교하기 <span className="font-normal">· 저장되지 않아요</span></p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={state === 'rec' ? () => mr.current?.stop() : start}
          className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm transition ${state === 'rec' ? 'border-rose-500 bg-rose-50 font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'border-border hover:bg-muted'}`}
        >
          {state === 'rec' ? <><span className="size-2.5 animate-pulse rounded-full bg-rose-600" />녹음 중… 누르면 멈춰요</> : <><Mic className="size-4" />{state === 'done' ? '다시 녹음' : '녹음하기'}</>}
        </button>
        <button type="button" onClick={play} disabled={state !== 'done'} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-sm transition hover:bg-muted disabled:opacity-40">
          {playing ? <><Pause className="size-4" />멈추기</> : <><Play className="size-4" />내 목소리 듣기</>}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  )
}
