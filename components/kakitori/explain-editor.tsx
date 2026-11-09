'use client'

import { useState } from 'react'
import { BookOpenText, ChevronDown, Loader2, MessageSquareQuote, Plus, Trash2 } from 'lucide-react'
import { generateExamples, generateExplain, needsExamples } from '@/lib/explain'
import { answerOf } from '@/lib/ruby'
import type { ExplainExample, Line, LineExplain } from '@/lib/types'
import { ExplainBody } from './explain-view'

const errText = (code?: string) =>
  code === 'no_key' ? 'API 키가 설정되지 않음'
  : code === 'rate_limited' ? '무료 사용량 초과'
  : code === 'busy' ? 'Gemini 서버가 바빠요'
  : code === 'timeout' ? '응답 시간 초과'
  : code === 'bad_key' ? 'API 키가 올바르지 않음'
  : code === 'forbidden' || code === 'unauthorized' ? '관리자 확인 실패'
  : '연결 오류'

const input = 'h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring'

/** 곡 편집 화면: 문장 풀이 만들기·고치기 (관리자용) */
export function ExplainEditor({ lines, onChange }: { lines: Line[]; onChange: (f: (rows: Line[] | null) => Line[] | null) => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)

  const usable = lines.filter((l) => answerOf(l.ruby))
  const doneCount = usable.filter((l) => l.explain).length
  const exNeed = lines.filter((l) => needsExamples(l.explain)).length

  // 새로 받은 예문을 지금 화면의 풀이에 합쳐요 (그사이 고친 내용은 그대로, 빈 예문만 채움)
  const mergeExamples = (explains: (LineExplain | undefined)[]) =>
    onChange((rows) =>
      rows?.map((l, i) => {
        const got = explains[i]
        if (!l.explain || !got || got.words.length !== l.explain.words.length) return l
        return {
          ...l,
          explain: {
            ...l.explain,
            words: l.explain.words.map((w, k) => (w.ex ? w : got.words[k]?.ex ? { ...w, ex: got.words[k].ex } : w)),
            grammar: l.explain.grammar.map((g, k) => (g.ex ? g : got.grammar[k]?.ex ? { ...g, ex: got.grammar[k].ex } : g)),
          },
        }
      }) ?? rows,
    )
  const buildExamples = async (base: Line[] = lines) => {
    setBusy(true)
    setMsg('예문을 만드는 중…')
    try {
      const r = await generateExamples(base, (d, t, note) => setMsg(note ?? `AI가 실생활 예문을 만드는 중… ${d} / ${t}`))
      mergeExamples(r.explains)
      setMsg(
        r.total === 0
          ? '모든 단어·문법에 예문이 있어요.'
          : r.failed
            ? `${r.total - r.failed}문장 예문을 만들었어요. ${r.failed}문장은 실패했어요(${errText(r.error)}${r.detail ? ` · ${r.detail}` : ''}). 다시 누르면 빈 것만 채워요.`
            : `${r.total}문장의 예문을 만들었어요. 곡을 저장해야 반영돼요.`,
      )
    } catch {
      setMsg('예문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const build = async () => {
    setBusy(true)
    setMsg('문장 풀이를 만드는 중…')
    try {
      const r = await generateExplain(lines, (d, t, note) => setMsg(note ?? `AI가 문장 풀이를 만드는 중… ${d} / ${t}`))
      onChange((rows) => rows?.map((l, i) => (r.explains[i] && !l.explain ? { ...l, explain: r.explains[i] } : l)) ?? rows)
      // 풀이를 새로 만들었으면 예문도 이어서 만들어요
      if (r.total > r.failed) {
        await buildExamples(lines.map((l, i) => (r.explains[i] && !l.explain ? { ...l, explain: r.explains[i] } : l)))
        return
      }
      setMsg(
        r.total === 0
          ? '모든 문장에 풀이가 있어요.'
          : r.failed
            ? `${r.total - r.failed}문장 풀이를 만들었어요. ${r.failed}문장은 실패했어요(${errText(r.error)}${r.detail ? ` · ${r.detail}` : ''}). 다시 누르면 빈 것만 채워요.`
            : `${r.total}문장 풀이를 만들었어요. 곡을 저장해야 반영돼요.`,
      )
    } catch {
      setMsg('풀이를 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const setEx = (i: number, ex: LineExplain | undefined) =>
    onChange((rows) =>
      rows?.map((l, j) => {
        if (j !== i) return l
        const next = { ...l }
        if (ex) next.explain = ex
        else delete next.explain
        return next
      }) ?? rows,
    )

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">문장 풀이 <span className="font-normal text-muted-foreground">· {doneCount} / {usable.length}문장</span></h2>
        <button onClick={build} disabled={busy || !usable.length} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <BookOpenText className="size-4" />}
          {doneCount ? '빈 문장 풀이 만들기' : '문장 풀이 만들기'}
        </button>
        {doneCount > 0 && (
          <button onClick={() => buildExamples()} disabled={busy || !exNeed} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            <MessageSquareQuote className="size-4" />
            {exNeed ? `예문 채우기 (${exNeed}문장)` : '예문 모두 있음'}
          </button>
        )}
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">AI가 문장마다 단어 뜻·품사, 문법 포인트, 직역·의역과 실생활 예문을 만들어요. 친구들은 채점한 뒤에 볼 수 있어요. 틀린 곳은 눌러서 고치고, 다시 만들고 싶은 문장은 풀이를 지운 뒤 버튼을 누르세요. 곡을 저장해야 반영돼요.</p>

      {doneCount > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          {lines.map((l, i) => {
            if (!l.explain) return null
            const isOpen = open === i
            return (
              <div key={i} className="border-b border-border last:border-0">
                <button onClick={() => { setOpen(isOpen ? null : i); setEditing(false) }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50">
                  <span className="w-6 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <span lang="ja" className="min-w-0 flex-1 truncate font-jp text-sm">{answerOf(l.ruby)}</span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">단어 {l.explain.words.length} · 문법 {l.explain.grammar.length}</span>
                  <ChevronDown className={`size-4 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-border bg-muted/20 p-3">
                    <div className="mb-2 flex justify-end gap-2">
                      <button onClick={() => setEditing((e) => !e)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted">{editing ? '미리보기' : '고치기'}</button>
                      <button onClick={() => { setEx(i, undefined); setOpen(null) }} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-3.5" />풀이 지우기</button>
                    </div>
                    {editing ? <ExplainForm ex={l.explain} onChange={(ex) => setEx(i, ex)} /> : <ExplainBody ex={l.explain} ruby={l.ruby} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExplainForm({ ex, onChange }: { ex: LineExplain; onChange: (ex: LineExplain) => void }) {
  const ex0 = ex
  const setWord = (i: number, k: keyof LineExplain['words'][number], v: string) => onChange({ ...ex, words: ex.words.map((w, j) => (j === i ? { ...w, [k]: v } : w)) })
  const setGrammar = (i: number, k: 'title' | 'body', v: string) => onChange({ ...ex, grammar: ex.grammar.map((g, j) => (j === i ? { ...g, [k]: v } : g)) })
  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">단어 (단어 · 읽기 · 품사 · 뜻 · 설명)</h4>
        <div className="flex flex-col gap-1.5">
          {ex.words.map((w, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_4.5rem_auto] gap-1.5 sm:grid-cols-[6rem_6rem_4.5rem_1fr_1.4fr_auto]">
              <input lang="ja" value={w.w} onChange={(e) => setWord(i, 'w', e.target.value)} aria-label="단어" className={`${input} font-jp`} />
              <input lang="ja" value={w.r} onChange={(e) => setWord(i, 'r', e.target.value)} aria-label="읽기" placeholder="읽기" className={`${input} font-jp`} />
              <input value={w.pos} onChange={(e) => setWord(i, 'pos', e.target.value)} aria-label="품사" className={input} />
              <button onClick={() => onChange({ ...ex, words: ex.words.filter((_, j) => j !== i) })} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive sm:order-last" aria-label="단어 지우기"><Trash2 className="size-4" /></button>
              <input value={w.m} onChange={(e) => setWord(i, 'm', e.target.value)} aria-label="뜻" placeholder="뜻" className={`${input} col-span-2 sm:col-span-1`} />
              <input value={w.note ?? ''} onChange={(e) => setWord(i, 'note', e.target.value)} aria-label="설명" placeholder="설명 (선택)" className={`${input} col-span-2 sm:col-span-1`} />
              <ExampleInputs ex={w.ex} onChange={(ex) => onChange({ ...ex0, words: ex0.words.map((x, j) => (j === i ? { ...x, ex } : x)) })} className="col-span-4 sm:col-span-6" />
            </div>
          ))}
          <button onClick={() => onChange({ ...ex, words: [...ex.words, { w: '', r: '', pos: '', m: '', note: '' }] })} className="inline-flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"><Plus className="size-3.5" />단어 추가</button>
        </div>
      </section>
      <section>
        <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">문법 포인트</h4>
        <div className="flex flex-col gap-2">
          {ex.grammar.map((g, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
              <div className="flex gap-1.5">
                <input lang="ja" value={g.title} onChange={(e) => setGrammar(i, 'title', e.target.value)} aria-label="문법 제목" className={`${input} flex-1 font-jp`} />
                <button onClick={() => onChange({ ...ex, grammar: ex.grammar.filter((_, j) => j !== i) })} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="문법 지우기"><Trash2 className="size-4" /></button>
              </div>
              <textarea value={g.body} onChange={(e) => setGrammar(i, 'body', e.target.value)} aria-label="문법 설명" rows={2} className="min-w-0 rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <ExampleInputs ex={g.ex} onChange={(ex) => onChange({ ...ex0, grammar: ex0.grammar.map((x, j) => (j === i ? { ...x, ex } : x)) })} />
            </div>
          ))}
          {ex.grammar.length < 3 && (
            <button onClick={() => onChange({ ...ex, grammar: [...ex.grammar, { title: '', body: '' }] })} className="inline-flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"><Plus className="size-3.5" />문법 추가</button>
          )}
        </div>
      </section>
      <section className="grid gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground">직역<input value={ex.literal} onChange={(e) => onChange({ ...ex, literal: e.target.value })} className={`${input} mt-1 w-full font-normal text-foreground`} /></label>
        <label className="text-xs font-semibold text-muted-foreground">의역<input value={ex.natural} onChange={(e) => onChange({ ...ex, natural: e.target.value })} className={`${input} mt-1 w-full font-normal text-foreground`} /></label>
      </section>
    </div>
  )
}

/** 예문 고치기: 일본어(후리가나 표기 가능) + 한국어. 둘 다 비우면 예문 없음 */
function ExampleInputs({ ex, onChange, className = '' }: { ex?: ExplainExample; onChange: (ex?: ExplainExample) => void; className?: string }) {
  const set = (k: 'ja' | 'ko', v: string) => {
    const next = { ja: ex?.ja ?? '', ko: ex?.ko ?? '', [k]: v }
    onChange(next.ja || next.ko ? next : undefined)
  }
  return (
    <div className={`grid grid-cols-1 gap-1.5 sm:grid-cols-2 ${className}`}>
      <input lang="ja" value={ex?.ja ?? ''} onChange={(e) => set('ja', e.target.value)} aria-label="예문 (일본어)" placeholder="예문 (일본어, 漢字{かな})" className={`${input} font-jp text-xs`} />
      <input value={ex?.ko ?? ''} onChange={(e) => set('ko', e.target.value)} aria-label="예문 해석" placeholder="예문 해석" className={`${input} text-xs`} />
    </div>
  )
}
