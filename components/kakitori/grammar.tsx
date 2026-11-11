'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, Music2, Search, SpellCheck } from 'lucide-react'
import { useStore } from '@/lib/store'
import { grammarIndex, grammarSpan, type GrammarEntry } from '@/lib/grammar'
import { reviewPlan } from '@/lib/review'
import { parseRuby } from '@/lib/ruby'
import { BackButton, Furigana } from './furigana'

type Sort = 'count' | 'name' | 'mine'

const norm = (t: string) => t.toLowerCase().replace(/[\s　~～〜]+/g, '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
const thumb = (id: string | null) => (id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null)

/** 문법 모음: 곡 해설에 나온 문법을 문법별로 모아서, 그 문법이 들어간 가사를 곡에 상관없이 보여 줘요 */
export function GrammarBook({ isAdmin, onBack, onGoLine }: { isAdmin: boolean; onBack: () => void; onGoLine: (songId: string, line: number) => void }) {
  const { songs, progress, ready } = useStore()
  const all = useMemo(() => grammarIndex(songs, isAdmin), [songs, isAdmin])
  // 내가 틀렸고 아직 외우지 못한 문장 (난이도 상관없이)
  const missed = useMemo(() => {
    const p = reviewPlan(songs, progress, isAdmin)
    return new Set([...p.due, ...p.upcoming].map((it) => `${it.song.id}:${it.line}`))
  }, [songs, progress, isAdmin])
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('count')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const open = all.find((g) => g.key === openKey)

  const missCount = (g: GrammarEntry) => g.hits.filter((h) => missed.has(`${h.song.id}:${h.line}`)).length
  const nq = norm(q)
  let list = nq ? all.filter((g) => norm(`${g.name} ${g.means.join(' ')}`).includes(nq)) : all
  if (sort === 'mine') list = list.filter((g) => missCount(g) > 0).sort((a, b) => missCount(b) - missCount(a) || b.hits.length - a.hits.length)
  else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  else list = [...list].sort((a, b) => b.hits.length - a.hits.length || a.name.localeCompare(b.name, 'ja'))

  if (open) return <GrammarDetail g={open} missed={missed} onBack={() => { setOpenKey(null); window.scrollTo(0, 0) }} onGoLine={onGoLine} />

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <BackButton onClick={onBack} />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">文法ノート</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">문법 모음</h1>
      <p className="mt-1 text-sm text-muted-foreground">곡 해설에 나온 문법을 모았어요. 문법을 누르면 그 문법이 들어간 가사를 곡에 상관없이 볼 수 있어요.</p>

      <label className="relative mt-5 block">
        <span className="sr-only">문법 찾기</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="문법이나 뜻으로 찾기 (예: たら, 할 수 있다)" className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {([['count', '많이 나온 순'], ['name', '가나다순'], ['mine', '내가 틀린 문법']] as [Sort, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setSort(k)} aria-pressed={sort === k} className={`h-8 rounded-full border px-3 text-xs font-medium transition ${sort === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40'}`}>{label}</button>
        ))}
      </div>

      {!ready ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <SpellCheck className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">{all.length === 0 ? '아직 모인 문법이 없어요' : sort === 'mine' && !nq ? '복습 중인 문장에 나온 문법이 없어요' : '찾는 문법이 없어요'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{all.length === 0 ? '곡에 문장 풀이가 생기면 여기에 모여요.' : sort === 'mine' && !nq ? '잘하고 있어요!' : '다른 말로 찾아보세요.'}</p>
        </div>
      ) : (
        <ul className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((g) => {
            const songsIn = [...new Map(g.hits.map((h) => [h.song.id, h.song])).values()]
            const miss = missCount(g)
            return (
              <li key={g.key} className="border-t border-border first:border-t-0">
                <button onClick={() => { setOpenKey(g.key); window.scrollTo(0, 0) }} className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-jp text-base font-bold">{g.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{g.means.slice(0, 2).join(', ') || '뜻 없음'}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground"><b className="text-sm text-foreground tabular-nums">{g.hits.length}</b>문장 · {songsIn.length}곡{miss > 0 && <span className="ml-1 rounded-full bg-destructive/10 px-1.5 text-[11px] font-bold text-destructive">복습 중 {miss}</span>}</span>
                    <span className="flex gap-0.5">
                      {songsIn.slice(0, 4).map((s) => (thumb(s.youtubeId) ? <img key={s.id} src={thumb(s.youtubeId)!} alt="" className="h-3.5 w-5 rounded-[3px] object-cover" /> : <span key={s.id} className="h-3.5 w-5 rounded-[3px] bg-muted" />))}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {ready && all.length > 0 && <p className="mt-3 text-xs text-muted-foreground">모두 {all.length}개 문법 · 곡이 늘어나면 저절로 늘어나요</p>}
    </main>
  )
}

function GrammarDetail({ g, missed, onBack, onGoLine }: { g: GrammarEntry; missed: Set<string>; onBack: () => void; onGoLine: (songId: string, line: number) => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← 문법 모음</button>
      <section className="rounded-3xl bg-gradient-to-br from-[#2f3a56] to-[#4a4677] p-5 text-[#f4efe4] sm:p-6">
        <h1 className="font-jp text-3xl font-black">{g.name}</h1>
        {g.means.length > 0 && <p className="mt-1 text-sm font-bold text-amber-300">{g.means.slice(0, 3).join(' · ')}</p>}
        {g.body && <p className="mt-3 text-sm leading-relaxed text-white/80">{g.body}</p>}
        {g.ex?.ja && (
          <div className="mt-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm [&_rt]:text-white/60">
            <p className="font-jp text-base leading-loose"><Furigana text={g.ex.ja} /></p>
            {g.ex.ko && <p className="text-white/70">{g.ex.ko}</p>}
          </div>
        )}
      </section>

      <p className="mb-2 mt-6 text-xs font-bold text-muted-foreground">노래 속 {g.name} · {g.hits.length}문장</p>
      <div className="flex flex-col gap-3">
        {g.hits.map((h) => {
          const l = h.song.lines[h.line]
          const t = thumb(h.song.youtubeId)
          return (
            <article key={`${h.song.id}-${h.line}`} className="rounded-2xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {t ? <img src={t} alt="" className="h-6 w-9 rounded object-cover" /> : <Music2 className="size-4" />}
                <b className="truncate font-jp text-[13px] text-foreground">{h.song.title}</b>
                <span className="truncate">· {h.song.artist} · {h.line + 1}번 문장</span>
                {missed.has(`${h.song.id}:${h.line}`) && <span className="ml-auto shrink-0 rounded-full bg-destructive/10 px-1.5 text-[11px] font-bold text-destructive">복습 중인 문장</span>}
              </p>
              <p className="mt-2 font-jp text-lg leading-loose"><Marked ruby={l?.ruby ?? ''} span={grammarSpan(g.name, l?.ruby ?? '')} /></p>
              {l?.ko && <p className="text-sm text-muted-foreground">{l.ko}</p>}
              {h.body && h.body !== g.body && <p className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{h.body}</p>}
              <button onClick={() => onGoLine(h.song.id, h.line)} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:border-primary/50">이 문장 풀기<ChevronRight className="size-3.5" /></button>
            </article>
          )
        })}
      </div>
    </main>
  )
}

/** 후리가나 문장에서 문법이 나온 자리를 노랗게 칠해요 */
function Marked({ ruby, span }: { ruby: string; span: [number, number] | null }) {
  if (!span) return <Furigana text={ruby} />
  const [a, b] = span
  const mark = 'rounded bg-amber-200/70 px-0.5 text-amber-900 dark:bg-amber-400/25 dark:text-amber-200'
  const out: React.ReactNode[] = []
  let pos = 0
  parseRuby(ruby).forEach((p, i) => {
    const s = pos
    const e = pos + p.text.length
    pos = e
    if (p.reading) {
      const node = <ruby>{p.text}<rt className="text-[0.55em] text-muted-foreground">{p.reading}</rt></ruby>
      out.push(e > a && s < b ? <mark key={i} className={mark}>{node}</mark> : <span key={i}>{node}</span>)
      return
    }
    const x = Math.max(a, s) - s
    const y = Math.min(b, e) - s
    if (y <= x) out.push(<span key={i}>{p.text}</span>)
    else out.push(<span key={i}>{p.text.slice(0, x)}<mark className={mark}>{p.text.slice(x, y)}</mark>{p.text.slice(y)}</span>)
  })
  return <span lang="ja">{out}</span>
}
