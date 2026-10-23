'use client'

import { useState } from 'react'
import { ChevronRight, Copy, Loader2, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actions, newSongId } from '@/lib/store'
import { generateFurigana } from '@/lib/furigana'
import { RubyEditable } from './ruby-edit'
import { KANJI, baseText } from '@/lib/ruby'
import { parseYouTubeId } from '@/lib/youtube'
import type { Line, Song } from '@/lib/types'
import { BackButton, Furigana } from './furigana'

const splitLines = (t: string) => t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
const inputCls = 'mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring'

export function Editor({ song, onBack, onSaved }: { song?: Song; onBack: () => void; onSaved: (id: string) => void }) {
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [yt, setYt] = useState(song?.youtubeId ? `https://youtu.be/${song.youtubeId}` : '')
  const [jp, setJp] = useState(song?.lines.map((l) => l.ruby).join('\n') ?? '')
  const [ko, setKo] = useState(song?.lines.map((l) => l.ko).join('\n') ?? '')
  const [rows, setRows] = useState<Line[] | null>(song ? song.lines : null)
  const [furiMsg, setFuriMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const jpCount = splitLines(jp).length
  const koCount = splitLines(ko).length
  const ytInvalid = yt.trim() !== '' && !parseYouTubeId(yt)

  const split = () => {
    const a = splitLines(jp)
    const b = splitLines(ko)
    const n = Math.max(a.length, b.length)
    setRows((old) => Array.from({ length: n }, (_, i) => ({ ruby: a[i] ?? '', ko: b[i] ?? '', start: old?.[i]?.start ?? null })))
    setError('')
  }
  const edit = (i: number, key: 'ruby' | 'ko', v: string) => setRows((r) => r?.map((l, j) => (j === i ? { ...l, [key]: v } : l)) ?? r)

  const autoFurigana = async () => {
    if (!rows) return
    setBusy(true)
    setFuriMsg('읽기를 만드는 중… (처음 한 번은 사전을 불러오느라 몇 초 걸려요)')
    try {
      const { results, aiUsed, aiError, aiDetail } = await generateFurigana(
        rows.map((l) => l.ruby),
        (done, total) => setFuriMsg(`AI가 읽기를 만드는 중… ${done} / ${total}`),
      )
      setRows(rows.map((l, i) => ({ ...l, ruby: results[i].ruby, check: results[i].check })))
      const flagged = results.reduce((n, r) => n + r.check.length, 0)
      const base = aiUsed ? 'AI로 읽기를 넣었어요.' : `AI를 쓸 수 없어서(${aiErrorText(aiError)}${aiDetail ? ` · ${aiDetail}` : ''}) 사전으로만 넣었어요.`
      setFuriMsg(flagged ? `${base} 노란 단어 ${flagged}개는 노래를 들으며 확인해 주세요.` : base)
    } catch {
      setFuriMsg('읽기를 만들지 못했어요. 漢字{かんじ} 형식으로 직접 적어 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    const youtubeId = yt.trim() ? parseYouTubeId(yt) : null
    const lines = (rows ?? []).filter((l) => l.ruby.trim()).map((l) => ({ ruby: l.ruby.trim(), ko: l.ko.trim(), start: l.start ?? null, ...(l.check?.length ? { check: l.check } : {}) }))
    if (!title.trim()) return setError('곡 제목을 적어 주세요.')
    if (ytInvalid) return setError('유튜브 링크 형식을 확인해 주세요.')
    if (!lines.length) return setError('가사를 붙여넣고 ‘문장 나누기’를 눌러 주세요.')
    const id = song?.id ?? newSongId()
    setBusy(true)
    setError('')
    try {
      await actions.saveSong({ id, title: title.trim(), artist: artist.trim(), youtubeId, lines, createdAt: song?.createdAt ?? Date.now() })
      onSaved(id)
    } catch {
      setError('저장하지 못했어요. 관리자 계정인지, 인터넷이 연결돼 있는지 확인해 주세요.')
      setBusy(false)
    }
  }

  const rowJp = rows?.filter((l) => l.ruby.trim()).length ?? 0
  const rowKo = rows?.filter((l) => l.ko.trim()).length ?? 0

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <BackButton onClick={onBack} />
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">관리자 · 곡 {song ? '편집' : '등록'}</p>
        <h1 className="mt-2 text-3xl font-bold">가사를 문장으로 정리해요</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">곡 제목<input id="song-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="곡 제목" className={`${inputCls} font-jp`} /></label>
        <label className="text-sm font-semibold">가수<input id="song-artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="가수 이름" className={inputCls} /></label>
        <label className="text-sm font-semibold">YouTube 링크
          <input id="song-yt" value={yt} onChange={(e) => setYt(e.target.value)} placeholder="https://youtube.com/watch?v=..." className={`${inputCls} ${ytInvalid ? 'border-destructive' : ''}`} />
          {ytInvalid && <span className="mt-1 block text-xs font-normal text-destructive">유튜브 주소 형식이 아니에요.</span>}
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">일본어 가사 <span className="font-normal text-muted-foreground">({jpCount}줄)</span>
          <textarea id="song-jp" lang="ja" value={jp} onChange={(e) => setJp(e.target.value)} placeholder="한 줄에 한 문장씩 붙여넣어 주세요" className="jp-writing mt-2 min-h-48 w-full rounded-xl border border-input bg-background p-4 font-jp font-normal leading-8 outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="text-sm font-semibold">한국어 해석 <span className="font-normal text-muted-foreground">({koCount}줄)</span>
          <textarea id="song-ko" value={ko} onChange={(e) => setKo(e.target.value)} placeholder="일본어 가사와 같은 줄 순서로 적어 주세요" className="mt-2 min-h-48 w-full rounded-xl border border-input bg-background p-4 font-normal leading-8 outline-none focus:ring-2 focus:ring-ring" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={split} disabled={!jpCount}><Copy data-icon="inline-start" />문장 나누기</Button>
        {jpCount > 0 && koCount > 0 && jpCount !== koCount && <p className="text-sm text-destructive">일본어와 한국어 줄 수가 달라요. ({jpCount}줄 / {koCount}줄)</p>}
        <span className="text-xs text-muted-foreground">빈 줄은 무시해요. 다시 나누면 아래에서 고친 내용은 덮어써져요.</span>
      </div>

      {rows && (
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold">문장 확인 <span className="font-normal text-muted-foreground">· 일본어 {rowJp} / 한국어 {rowKo}</span></h2>
            <button onClick={autoFurigana} disabled={busy || !rows.length} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Settings2 className="size-4" />}AI로 한자 읽기 만들기
            </button>
            {furiMsg && <span className="text-xs text-muted-foreground">{furiMsg}</span>}
          </div>
          <p className="mb-4 text-xs leading-5 text-muted-foreground">한자를 누르면 읽기를 고칠 수 있어요. <span className="rounded bg-amber-200/70 px-1 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200">노란 단어</span>는 AI와 사전의 읽기가 다르거나 AI가 확신하지 못한 단어예요. 타이밍 화면에서 노래를 들으며 확인할 수도 있어요.</p>
          <div className="flex flex-col gap-3">
            {rows.map((row, i) => {
              const bad = !row.ruby.trim() || !row.ko.trim()
              return (
                <div key={i} className={`rounded-xl border p-4 ${bad ? 'border-destructive bg-destructive/5' : 'border-border bg-card'}`}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <span className="min-w-0 text-lg">{row.ruby ? <RubyEditable value={row.ruby} check={row.check} onChange={(ruby, check) => setRows((r) => r?.map((l, j) => (j === i ? { ...l, ruby, check } : l)) ?? r)} /> : <span className="text-sm text-destructive">일본어 없음</span>}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input id={`row-jp-${i}`} lang="ja" value={row.ruby} onChange={(e) => edit(i, 'ruby', e.target.value)} aria-label={`${i + 1}번 일본어`} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 font-jp" />
                    <input id={`row-ko-${i}`} value={row.ko} onChange={(e) => edit(i, 'ko', e.target.value)} placeholder="한국어 해석" aria-label={`${i + 1}번 해석`} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
        {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
        <Button variant="outline" onClick={onBack}>취소</Button>
        <Button onClick={save} disabled={busy}>저장하고 타이밍 맞추기<ChevronRight data-icon="inline-end" /></Button>
      </div>
    </main>
  )
}

function aiErrorText(code?: string) {
  if (code === 'no_key') return 'API 키가 설정되지 않음'
  if (code === 'rate_limited') return '무료 사용량 초과, 잠시 후 다시'
  if (code === 'timeout') return '응답 시간 초과'
  if (code === 'busy') return 'Gemini 서버가 바빠요. 잠시 후 다시 눌러 주세요'
  if (code === 'bad_key') return 'API 키가 올바르지 않음'
  if (code === 'forbidden' || code === 'unauthorized') return '관리자 확인 실패'
  return '연결 오류'
}
