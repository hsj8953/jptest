'use client'

import { useState } from 'react'
import { BookOpen, Loader2, Plus, Trash2, Volume2 } from 'lucide-react'
import { extractWords, fillWordInfo, speak } from '@/lib/words'
import type { Line, SongWord } from '@/lib/types'

const errText = (code?: string) =>
  code === 'no_key' ? 'API 키가 설정되지 않음'
  : code === 'rate_limited' ? '무료 사용량 초과'
  : code === 'busy' ? 'Gemini 서버가 바빠요'
  : code === 'timeout' ? '응답 시간 초과'
  : code === 'bad_key' ? 'API 키가 올바르지 않음'
  : code === 'forbidden' || code === 'unauthorized' ? '관리자 확인 실패'
  : '연결 오류'

/** 곡 편집 화면의 단어장 만들기·고치기 (관리자용) */
export function WordEditor({ lines, words, onChange }: { lines: Line[]; words: SongWord[]; onChange: (w: SongWord[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const build = async () => {
    if (!lines.length) return
    setBusy(true)
    setMsg('가사에서 한자 단어를 찾는 중… (처음 한 번은 사전을 불러오느라 몇 초 걸려요)')
    try {
      const found = await extractWords(lines)
      // 이미 고쳐 둔 뜻·읽기는 그대로 살려요
      const prev = new Map(words.map((w) => [w.word, w]))
      const merged = found.map((w) => {
        const p = prev.get(w.word)
        return p ? { ...w, reading: p.reading || w.reading, meaning: p.meaning } : w
      })
      const need = merged.filter((w) => !w.meaning)
      if (!need.length) {
        onChange(merged)
        setMsg(`단어 ${merged.length}개를 찾았어요.`)
        return
      }
      const r = await fillWordInfo(need, lines, (d, t) => setMsg(`AI가 뜻을 붙이는 중… ${d} / ${t}`))
      const filled = new Map(r.words.map((w) => [w.word, w]))
      const result = merged.map((w) => filled.get(w.word) ?? w)
      onChange(result)
      setMsg(
        r.error
          ? `단어 ${result.length}개를 찾았지만 AI를 쓸 수 없어서(${errText(r.error)}${r.detail ? ` · ${r.detail}` : ''}) 뜻은 비워 뒀어요. 직접 적거나 다시 눌러 주세요.`
          : `단어 ${result.length}개를 찾았어요. 틀린 읽기나 뜻은 고치고, 필요 없는 단어는 지워 주세요.`,
      )
    } catch {
      setMsg('단어를 찾지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const edit = (i: number, key: 'word' | 'reading' | 'meaning', v: string) => onChange(words.map((w, j) => (j === i ? { ...w, [key]: v } : w)))
  const remove = (i: number) => onChange(words.filter((_, j) => j !== i))
  const add = () => onChange([...words, { word: '', reading: '', meaning: '', lines: [] }])

  const input = 'h-10 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">단어장 <span className="font-normal text-muted-foreground">· 한자 단어 {words.length}개</span></h2>
        <button onClick={build} disabled={busy || !lines.length} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
          {words.length ? '단어장 다시 만들기' : '단어장 만들기'}
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">가사에서 한자가 들어간 단어를 사전형(예: 咲いた → 咲く)으로 모으고, AI가 읽기와 한국어 뜻을 붙여요. 다시 만들어도 이미 적어 둔 뜻은 유지돼요. 곡을 저장해야 단어장에 반영돼요.</p>

      {words.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="hidden grid-cols-[1fr_1fr_1.4fr_auto] gap-2 border-b border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground sm:grid">
            <span>단어</span><span>읽기</span><span>뜻</span><span className="w-20 text-right">문장</span>
          </div>
          {words.map((w, i) => (
            <div key={i} className={`grid grid-cols-2 gap-2 border-b border-border px-3 py-2.5 last:border-0 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-center ${!w.meaning || !w.reading ? 'bg-amber-50/60 dark:bg-amber-500/10' : ''}`}>
              <input id={`w-word-${i}`} lang="ja" value={w.word} onChange={(e) => edit(i, 'word', e.target.value)} aria-label="단어" className={`${input} font-jp text-base`} />
              <input id={`w-read-${i}`} lang="ja" value={w.reading} onChange={(e) => edit(i, 'reading', e.target.value)} placeholder="ひらがな" aria-label="읽기" className={`${input} font-jp`} />
              <input id={`w-mean-${i}`} value={w.meaning} onChange={(e) => edit(i, 'meaning', e.target.value)} placeholder="한국어 뜻" aria-label="뜻" className={`${input} col-span-2 sm:col-span-1`} />
              <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1 sm:w-20">
                <span className="mr-auto text-xs text-muted-foreground sm:mr-1">{w.lines.length ? w.lines.map((n) => n + 1).slice(0, 3).join(', ') + (w.lines.length > 3 ? '…' : '') : '—'}</span>
                <button onClick={() => speak(w.reading || w.word)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`${w.word} 발음 듣기`}><Volume2 className="size-4" /></button>
                <button onClick={() => remove(i)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={`${w.word} 지우기`}><Trash2 className="size-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {words.length > 0 && (
        <button onClick={add} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <Plus className="size-4" />단어 직접 추가
        </button>
      )}
    </div>
  )
}
