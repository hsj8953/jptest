'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Mic, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HIRAGANA, KATAKANA, cellsOf } from '@/lib/kana'
import { useStore } from '@/lib/store'
import { generateAudio, loadVoiceConfig, saveVoiceConfig, vvPreview, vvSpeakers, type VoiceConfig, type VvSpeaker } from '@/lib/voice'

/** 관리자용: VOICEVOX로 단어장 음성 만들기 */
export function VoicePanel() {
  const { songs } = useStore()
  const [open, setOpen] = useState(false)
  const [speakers, setSpeakers] = useState<VvSpeaker[] | null>(null)
  const [conn, setConn] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [config, setConfig] = useState<VoiceConfig | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    loadVoiceConfig().then((c) => {
      setConfig(c)
      if (c) setPick(c.speaker)
    })
  }, [])

  const kanaTexts = useMemo(() => cellsOf([...HIRAGANA, ...KATAKANA]).map((c) => c.kana), [])
  const wordTexts = useMemo(() => songs.flatMap((s) => (s.words ?? []).map((w) => w.reading || w.word)).filter(Boolean), [songs])

  const connect = async () => {
    setConn('checking')
    setMsg('')
    try {
      const list = await vvSpeakers()
      setSpeakers(list)
      setConn('ok')
      if (pick == null && list[0]?.styles[0]) setPick(list[0].styles[0].id)
    } catch {
      setConn('fail')
    }
  }

  const label = (id: number | null) => {
    for (const sp of speakers ?? []) for (const st of sp.styles) if (st.id === id) return { name: sp.name, style: st.name }
    return null
  }

  const run = async (texts: string[], what: string) => {
    if (pick == null) return
    const l = label(pick)
    setBusy(true)
    try {
      // 목소리를 바꿨으면 먼저 저장해요 (이후 모두가 이 목소리로 들어요)
      if (!config || config.speaker !== pick) {
        const c = { speaker: pick, credit: l ? `VOICEVOX:${l.name}` : 'VOICEVOX' }
        await saveVoiceConfig(c)
        setConfig(c)
      }
      const r = await generateAudio(texts, pick, (d, t, made) => setMsg(`${what} 음성 만드는 중… ${d} / ${t} (새로 만든 것 ${made}개)`))
      setMsg(`${what} 음성 ${r.total}개 준비 끝! 새로 만든 것 ${r.made}개, 이미 있던 것 ${r.total - r.made}개.`)
    } catch (e) {
      const m = (e as Error).message ?? ''
      setMsg(/fetch|network|Failed/i.test(m) ? 'VOICEVOX에 연결이 끊겼어요. 프로그램이 켜져 있는지 확인해 주세요.' : /permission|insufficient/i.test(m) ? 'Firebase 보안 규칙에 audio 저장 권한이 없어요. 규칙을 업데이트해 주세요.' : `음성을 만들지 못했어요. (${m})`)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); connect() }} className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
        <Mic className="size-4" />음성 만들기 (관리자){config && <span className="text-xs">· 지금 목소리 {config.credit}</span>}
      </button>
    )
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">음성 만들기 <span className="font-normal text-muted-foreground">· VOICEVOX</span></h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${conn === 'ok' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : conn === 'fail' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
          {conn === 'ok' ? '연결됨' : conn === 'fail' ? '연결 안 됨' : '확인 중…'}
        </span>
        <button onClick={() => setOpen(false)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">닫기</button>
      </div>

      {conn === 'fail' && (
        <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm leading-6">
          <p>VOICEVOX에 연결하지 못했어요. 확인해 주세요.</p>
          <ol className="mt-1 list-decimal pl-5 text-muted-foreground">
            <li>VOICEVOX 프로그램이 켜져 있나요?</li>
            <li><code>http://localhost:50021/setting</code>의 Allow Origin에 <code>{typeof window !== 'undefined' ? window.location.origin : ''}</code> 를 넣고 VOICEVOX를 다시 켰나요?</li>
            <li>크롬이 "로컬 네트워크 접근"을 물어봤다면 허용했나요? (주소창 왼쪽 아이콘에서 바꿀 수 있어요)</li>
          </ol>
          <Button size="sm" variant="outline" className="mt-2" onClick={connect}><RefreshCw data-icon="inline-start" />다시 연결</Button>
        </div>
      )}

      {conn === 'ok' && speakers && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={pick ?? ''} onChange={(e) => setPick(Number(e.target.value))} className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm" aria-label="목소리">
              {speakers.map((sp) => (
                <optgroup key={sp.name} label={sp.name}>
                  {sp.styles.map((st) => <option key={st.id} value={st.id}>{sp.name} · {st.name}</option>)}
                </optgroup>
              ))}
            </select>
            <Button size="sm" variant="outline" disabled={pick == null || busy} onClick={() => pick != null && vvPreview('おはよう、よぞら', pick).catch(() => setMsg('미리 듣기에 실패했어요.'))}>
              <Play data-icon="inline-start" />미리 듣기
            </Button>
          </div>
          {config && pick !== config.speaker && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">목소리를 바꾸면 음성을 새로 만들어야 해요. 만들기 전까지는 기기 음성으로 읽어요.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(kanaTexts, '가나 표')}>{busy && <Loader2 className="animate-spin" data-icon="inline-start" />}가나 표 음성 ({kanaTexts.length})</Button>
            <Button size="sm" disabled={busy || !wordTexts.length} onClick={() => run(wordTexts, '노래 단어')}>{busy && <Loader2 className="animate-spin" data-icon="inline-start" />}노래 단어 음성 ({new Set(wordTexts).size})</Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">이미 만든 음성은 건너뛰고 없는 것만 만들어요. 새 곡의 단어장을 만든 뒤 한 번 더 누르면 돼요.</p>
        </>
      )}
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </section>
  )
}
