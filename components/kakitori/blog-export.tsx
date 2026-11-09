'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ClipboardCopy, X } from 'lucide-react'
import { blanksFor } from '@/lib/blanks'
import { answerOf, parseRuby, readingsFromRuby } from '@/lib/ruby'
import type { Song } from '@/lib/types'

/**
 * 관리자: 곡의 '문장 풀이'를 블로그 글 재료로 내보내기.
 * 고른 문장만 내보내고, 가사 전체는 내보내지 않아요.
 */
type Opt = 'reading' | 'ko' | 'words' | 'grammar' | 'literal'
const OPT_LABEL: Record<Opt, string> = { reading: '읽기(후리가나)', ko: '해석', words: '단어 표', grammar: '문법 포인트', literal: '직역' }
const SITE = 'https://kakitori-note.vercel.app'
const NUM = ['①', '②', '③', '④', '⑤', '⑥']

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** 후리가나를 붙인 소리 그대로 (夜空{よぞら}に → よぞらに) */
const readingOf = (ruby: string) => parseRuby(ruby).map((p) => p.reading || p.text).join('')

export function BlogExport({ song, onClose }: { song: Song; onClose: () => void }) {
  const usable = useMemo(() => song.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.explain && answerOf(l.ruby)), [song])
  // 처음엔 단어·문법이 많은 문장 3개를 골라 둬요
  const [picked, setPicked] = useState<number[]>(() =>
    [...usable]
      .sort((a, b) => (b.l.explain!.words.length + b.l.explain!.grammar.length * 2) - (a.l.explain!.words.length + a.l.explain!.grammar.length * 2))
      .slice(0, 3)
      .map((x) => x.i)
      .sort((a, b) => a - b),
  )
  const [opts, setOpts] = useState<Set<Opt>>(new Set(['reading', 'ko', 'words', 'grammar']))
  const quizChoices = useMemo(
    () => picked.flatMap((i) => blanksFor(song, i).answers.map((a, k) => ({ i, k, a: a.text }))),
    [picked, song],
  )
  const [quiz, setQuiz] = useState<string>('') // `${i}-${k}` 또는 '' (문제 없음)
  useEffect(() => {
    if (!quizChoices.some((q) => `${q.i}-${q.k}` === quiz)) setQuiz(quizChoices[0] ? `${quizChoices[0].i}-${quizChoices[0].k}` : '')
  }, [quizChoices]) // eslint-disable-line react-hooks/exhaustive-deps
  const [copied, setCopied] = useState<'' | 'claude' | 'naver'>('')

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const link = `${SITE}/?v=study&song=${encodeURIComponent(song.id)}`
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort((a, b) => a - b)))
  const toggleOpt = (o: Opt) => setOpts((s) => {
    const n = new Set(s)
    if (n.has(o)) n.delete(o)
    else n.add(o)
    return n
  })

  // 받아쓰기 문제: 그 빈칸만 ＿＿로 가린 문장
  const quizData = (() => {
    const q = quizChoices.find((x) => `${x.i}-${x.k}` === quiz)
    if (!q) return null
    const b = blanksFor(song, q.i)
    const text = b.parts.map((p) => (p.blank === q.k ? '＿＿＿' : p.text)).join('')
    return { n: q.i + 1, text, answer: q.a }
  })()

  const rows = picked.map((i) => {
    const l = song.lines[i]
    const ex = l.explain!
    const reads = readingsFromRuby(l.ruby, ex.words.map((w) => w.w))
    return { n: i + 1, ja: answerOf(l.ruby), reading: readingOf(l.ruby), ko: ex.natural || l.ko, literal: ex.literal, words: ex.words.map((w, k) => ({ ...w, r: reads[k] ?? w.r })), grammar: ex.grammar }
  })

  const plain = () => {
    const out = [`[곡] ${song.title} / ${song.artist}`, `[사이트 링크] ${link}`, '']
    for (const r of rows) {
      out.push(`[문장 ${r.n}]`, `가사: ${r.ja}`)
      if (opts.has('reading')) out.push(`읽기: ${r.reading}`)
      if (opts.has('ko')) out.push(`해석: ${r.ko}`)
      if (opts.has('literal') && r.literal) out.push(`직역: ${r.literal}`)
      if (opts.has('words')) for (const w of r.words) out.push(`단어: ${w.w} · ${w.r} · ${w.pos} · ${w.m}${w.note ? ` (${w.note})` : ''}`)
      if (opts.has('grammar')) for (const g of r.grammar) out.push(`문법: ${g.title} — ${g.body.replace(/\n/g, ' ')}`)
      out.push('')
    }
    if (quizData) out.push(`[받아쓰기 문제] 문장 ${quizData.n}: ${quizData.text}`, `정답: ${quizData.answer}`)
    return out.join('\n')
  }

  const html = () => {
    const td = 'style="border:1px solid #ddd;padding:6px 10px"'
    const parts: string[] = []
    rows.forEach((r, k) => {
      parts.push(`<h3>오늘 배울 문장 ${NUM[k] ?? k + 1}</h3>`)
      parts.push(`<p style="font-size:20px"><b>${esc(r.ja)}</b></p>`)
      if (opts.has('reading')) parts.push(`<p>읽기: ${esc(r.reading)}</p>`)
      if (opts.has('ko')) parts.push(`<p>해석: ${esc(r.ko)}</p>`)
      if (opts.has('literal') && r.literal) parts.push(`<p>직역: ${esc(r.literal)}</p>`)
      if (opts.has('words') && r.words.length)
        parts.push(
          `<table style="border-collapse:collapse"><tr><th ${td}>단어</th><th ${td}>읽기</th><th ${td}>품사</th><th ${td}>뜻</th></tr>` +
            r.words.map((w) => `<tr><td ${td}>${esc(w.w)}</td><td ${td}>${esc(w.r)}</td><td ${td}>${esc(w.pos)}</td><td ${td}>${esc(w.m)}${w.note ? `<br><small>${esc(w.note)}</small>` : ''}</td></tr>`).join('') +
            '</table>',
        )
      if (opts.has('grammar')) for (const g of r.grammar) parts.push(`<p><b>📌 문법 포인트 · ${esc(g.title)}</b><br>${esc(g.body).replace(/\n/g, '<br>')}</p>`)
      parts.push('<p><br></p>')
    })
    if (quizData) {
      parts.push('<h3>받아쓰기 도전!</h3>', `<p>빈칸에 들어갈 말은? (정답은 글 맨 아래)</p><p style="font-size:20px"><b>${esc(quizData.text)}</b></p>`)
    }
    parts.push(`<p>노래 전체를 한 문장씩 듣고 받아쓰기하고 싶다면 카키토리 노트에서 해 보세요.</p><p>👉 <a href="${link}">카키토리 노트에서 ${esc(song.title)} 받아쓰기</a></p>`)
    if (quizData) parts.push(`<p><small>정답: ${esc(quizData.answer)}</small></p>`)
    return parts.join('')
  }

  const copy = async (kind: 'claude' | 'naver') => {
    const text = plain()
    try {
      if (kind === 'naver' && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html()], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })])
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      // 클립보드 권한이 없을 때: 숨긴 칸에 넣고 복사
      const el = document.createElement(kind === 'naver' ? 'div' : 'textarea')
      if (el instanceof HTMLTextAreaElement) el.value = text
      else {
        el.innerHTML = html()
        el.contentEditable = 'true'
      }
      el.style.cssText = 'position:fixed;left:-9999px;top:0'
      document.body.appendChild(el)
      const r = document.createRange()
      r.selectNodeContents(el)
      const s = window.getSelection()
      s?.removeAllRanges()
      if (el instanceof HTMLTextAreaElement) el.select()
      else s?.addRange(r)
      document.execCommand('copy')
      el.remove()
    }
    setCopied(kind)
    window.setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 py-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="블로그용 내보내기" className="hint-pop max-h-full w-full max-w-xl overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">📝 블로그용 내보내기</h2>
          <button onClick={onClose} className="ml-auto grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="닫기"><X className="size-4" /></button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground"><span lang="ja" className="font-jp">{song.title}</span> · {song.artist} — 블로그에 쓸 문장을 고르고 복사하세요.</p>

        {usable.length === 0 ? (
          <p className="mt-6 rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">이 곡은 아직 문장 풀이가 없어요. 곡 편집에서 문장 풀이를 먼저 만들어 주세요.</p>
        ) : (
          <>
            <p className="mt-4 text-xs font-semibold text-muted-foreground">오늘 배울 문장 <span className="font-normal">(3개 추천 · 문장 풀이가 있는 것만 · {picked.length}개 고름)</span></p>
            <div className="mt-1.5 flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
              {usable.map(({ l, i }) => {
                const on = picked.includes(i)
                return (
                  <button key={i} onClick={() => toggle(i)} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition ${on ? 'border-primary bg-primary/[0.06]' : 'border-border hover:bg-muted/50'}`}>
                    <span className={`grid size-4.5 shrink-0 place-items-center rounded-[5px] border-2 ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                    <span className="w-6 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                    <span lang="ja" className="min-w-0 flex-1 truncate font-jp">{answerOf(l.ruby)}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">단어 {l.explain!.words.length} · 문법 {l.explain!.grammar.length}</span>
                  </button>
                )
              })}
            </div>

            <p className="mt-4 text-xs font-semibold text-muted-foreground">넣을 내용</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(Object.keys(OPT_LABEL) as Opt[]).map((o) => (
                <button key={o} onClick={() => toggleOpt(o)} className={`h-8 rounded-full border px-3 text-xs font-semibold transition ${opts.has(o) ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>{OPT_LABEL[o]}</button>
              ))}
            </div>

            <p className="mt-4 text-xs font-semibold text-muted-foreground">받아쓰기 문제로 낼 빈칸 <span className="font-normal">(보통 난이도 빈칸)</span></p>
            <select value={quiz} onChange={(e) => setQuiz(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="">받아쓰기 문제 없음</option>
              {quizChoices.map((q) => <option key={`${q.i}-${q.k}`} value={`${q.i}-${q.k}`}>{q.i + 1}번 문장 · 빈칸 「{q.a}」</option>)}
            </select>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => copy('claude')} disabled={!picked.length} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-40">
                {copied === 'claude' ? <><Check className="size-4" />복사했어요</> : <><ClipboardCopy className="size-4" />Claude에게 줄 내용 복사</>}
              </button>
              <button onClick={() => copy('naver')} disabled={!picked.length} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                {copied === 'naver' ? <><Check className="size-4" />복사했어요</> : <><ClipboardCopy className="size-4" />네이버에 바로 붙여넣기용 복사</>}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">고른 문장만 내보내요. 가사 전체는 내보내지 않아요. 링크를 누르면 이 곡이 바로 열려요.</p>
          </>
        )}
      </div>
    </div>
  )
}
