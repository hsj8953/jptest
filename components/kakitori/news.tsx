'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Bell, ChevronDown, ExternalLink, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { deleteNews, postNews, useStore, type NewsEntry, type NewsItem, type NewsKind, type NewsLink } from '@/lib/store'

/* ── 어디까지 읽었는지 (기기마다 기억) ─────────────────────────
   kakitori.news.seen = 마지막으로 확인한 소식의 시각. 처음 온 사람은 최근 7일 소식만 새 소식으로 쳐요. */
const SEEN_KEY = 'kakitori.news.seen'
const EVT = 'kakitori-news-seen'
function readSeen() {
  try {
    const v = window.localStorage.getItem(SEEN_KEY)
    return v ? Number(v) || 0 : Date.now() - 7 * 864e5
  } catch {
    return Date.now()
  }
}
let seenCache: number | null = null
function getSeen() {
  if (seenCache == null) seenCache = readSeen()
  return seenCache
}
function subscribeSeen(cb: () => void) {
  window.addEventListener(EVT, cb)
  return () => window.removeEventListener(EVT, cb)
}
export function markNewsSeen(at: number) {
  if (at <= getSeen()) return
  seenCache = at
  try {
    window.localStorage.setItem(SEEN_KEY, String(at))
  } catch {}
  window.dispatchEvent(new Event(EVT))
}

const KIND: Record<NewsKind, { label: string; c: string }> = {
  new: { label: '새 기능', c: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' },
  improve: { label: '개선', c: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  fix: { label: '수정', c: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300' },
}
const KIND_ORDER: NewsKind[] = ['new', 'improve', 'fix']
export const LINK_LABEL: Record<NewsLink, string> = { stamps: '도장 수첩 열기', vocab: '단어장 열기', wrong: '오답 노트 열기', help: '사용법 보기', progress: '학습 현황 열기' }
const dayKey = (ms: number) => new Date(ms).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
const dayTitle = (ms: number) => `${new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })} 업데이트`
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })

/** 패치 노트 글 하나 (예전 형식의 한 줄짜리 소식은 같은 날끼리 묶어서 글 하나로) */
type Post = { key: string; title: string; createdAt: number; blog: string | null; items: NewsEntry[]; ids: string[] }
function toPosts(news: NewsItem[]): Post[] {
  const posts: Post[] = []
  const legacy = new Map<string, Post>()
  for (const n of news) {
    if (n.items?.length) {
      posts.push({ key: n.id, title: n.title || dayTitle(n.createdAt), createdAt: n.createdAt, blog: n.blog ?? null, items: n.items, ids: [n.id] })
      continue
    }
    const k = dayKey(n.createdAt)
    const p = legacy.get(k) ?? { key: `day-${k}`, title: dayTitle(n.createdAt), createdAt: 0, blog: null, items: [], ids: [] }
    p.createdAt = Math.max(p.createdAt, n.createdAt)
    p.blog ||= n.blog ?? null
    p.items.push({ kind: n.kind ?? 'new', title: n.title, body: n.body, link: n.link })
    p.ids.push(n.id)
    legacy.set(k, p)
  }
  return [...posts, ...legacy.values()].sort((a, b) => b.createdAt - a.createdAt)
}
const summary = (items: NewsEntry[]) =>
  KIND_ORDER.map((k) => [k, items.filter((i) => i.kind === k).length] as const)
    .filter(([, n]) => n)
    .map(([k, n]) => `${KIND[k].label} ${n}개`)
    .join(' · ')

function usePosts() {
  const { news } = useStore()
  return useMemo(() => toPosts(news), [news])
}
/** 안 읽은 패치 노트 */
export function useUnreadNews() {
  const posts = usePosts()
  const seen = useSyncExternalStore(subscribeSeen, getSeen, () => Number.MAX_SAFE_INTEGER)
  return posts.filter((p) => p.createdAt > seen)
}

/** 헤더의 알림 버튼 */
export function NewsBell({ onOpen }: { onOpen: () => void }) {
  const unread = useUnreadNews().length
  return (
    <button onClick={onOpen} className="relative grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={unread ? `업데이트 소식 (새 소식 ${unread}개)` : '업데이트 소식'} title="업데이트 소식">
      <Bell className="size-4" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-background">{unread > 9 ? '9+' : unread}</span>
      )}
    </button>
  )
}

/** 곡 목록 맨 위: 가장 최근 새 패치 노트 한 줄 */
export function NewsBanner({ onOpen }: { onOpen: () => void }) {
  const unread = useUnreadNews()
  const top = unread[0]
  if (!top) return null
  return (
    <div className="hint-pop mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#2f3a56] text-[#f2b84b]"><Sparkles className="size-4" /></span>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <b className="block truncate text-sm">{top.title}</b>
        <span className="block truncate text-xs text-muted-foreground">{summary(top.items)}{unread.length > 1 ? ` · 새 소식 ${unread.length}개` : ''}</span>
      </button>
      <button onClick={onOpen} className="shrink-0 text-xs font-semibold text-primary hover:underline">보기 →</button>
      <button onClick={() => markNewsSeen(top.createdAt)} className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="알림 닫기"><X className="size-4" /></button>
    </div>
  )
}

/** 업데이트 소식 창: 패치 노트 글 목록, 누르면 펼쳐지고 다시 누르면 접혀요 */
export function NewsModal({ isAdmin, onClose, onLink }: { isAdmin: boolean; onClose: () => void; onLink: (l: NewsLink) => void }) {
  const posts = usePosts()
  // 열 때의 '읽은 시각'으로 NEW를 표시하고, 열자마자 다 읽은 걸로 해요
  const [seenAtOpen] = useState(getSeen)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [writing, setWriting] = useState(false)
  const [all, setAll] = useState(false)
  useEffect(() => {
    if (posts[0]) markNewsSeen(posts[0].createdAt)
  }, [posts])
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
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const shown = all ? posts : posts.slice(0, 8)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 py-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="업데이트 소식" className="hint-pop max-h-full w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-[#e0a32e]" />
          <h2 className="text-lg font-bold">업데이트 소식</h2>
          {isAdmin && !writing && (
            <button onClick={() => setWriting(true)} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-muted"><Plus className="size-3.5" />새 소식</button>
          )}
          <button onClick={onClose} className={`${isAdmin && !writing ? '' : 'ml-auto'} grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted`} aria-label="닫기"><X className="size-4" /></button>
        </div>

        {writing && <NewsForm onDone={() => setWriting(false)} />}

        {posts.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">아직 올라온 소식이 없어요.</p>
            {isAdmin && !writing && <StarterButton />}
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {shown.map((p) => {
              const isOpen = open.has(p.key)
              const isNew = p.createdAt > seenAtOpen
              return (
                <li key={p.key} className={`overflow-hidden rounded-2xl border transition ${isOpen ? 'border-primary/30 bg-primary/[0.03]' : 'border-border'}`}>
                  <button onClick={() => toggle(p.key)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {isNew && <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-4 text-white">NEW</span>}
                        <b className="truncate">{p.title}</b>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{fmtDate(p.createdAt)} · {summary(p.items)}</span>
                    </span>
                    <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="hint-pop border-t border-border px-4 pb-4 pt-1">
                      <ul>
                        {p.items.map((it, k) => (
                          <li key={k} className="border-b border-border/70 py-3 last:border-0">
                            <p className="text-sm font-bold leading-6">
                              <span className={`mr-1.5 inline-block rounded-md px-1.5 py-px align-[1px] text-[11px] font-bold ${KIND[it.kind]?.c ?? 'bg-muted'}`}>{KIND[it.kind]?.label ?? '소식'}</span>
                              {it.title}
                            </p>
                            {it.body && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{it.body}</p>}
                            {it.link && LINK_LABEL[it.link] && (
                              <button onClick={() => onLink(it.link!)} className="mt-2 rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/5">{LINK_LABEL[it.link]} →</button>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex items-center gap-2">
                        {p.blog && (
                          <a href={p.blog} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted">블로그에서 자세히<ExternalLink className="size-3" /></a>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => window.confirm(`'${p.title}' 소식을 지울까요? 되돌릴 수 없어요.`) && p.ids.forEach((id) => deleteNews(id))}
                            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-destructive"
                          ><Trash2 className="size-3.5" />소식 지우기</button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!all && posts.length > shown.length && (
          <button onClick={() => setAll(true)} className="mt-2 w-full rounded-lg py-2 text-sm text-muted-foreground hover:bg-muted">지난 소식 더 보기</button>
        )}
      </div>
    </div>
  )
}

/** 11월 7일 블로그 '업데이트 내역' 글 내용 */
const STARTER = {
  title: '11월 7일 업데이트',
  createdAt: new Date('2026-11-07T21:00:00+09:00').getTime(),
  items: [
    { kind: 'new', title: '사용법 안내', body: '처음 들어오면 카드 4장으로 사이트 사용법을 알려 줘요. 다시 보고 싶으면 곡 목록 위의 사용법 버튼을 누르세요.', link: 'help' },
    { kind: 'new', title: '완주 도장과 도장 수첩', body: '한 난이도의 진행 막대를 꽉 채우면 곡 카드에 易·普·難 도장이 찍혀요. 완주하는 순간 完走 도장 창이 뜨고, 도장 수첩에서 모든 곡의 도장을 모아 볼 수 있어요.', link: 'stamps' },
    { kind: 'new', title: '따라 말하기 (실험 기능)', body: "문장을 채점한 뒤 '따라 말하기'를 누르고 소리 내서 읽어 보세요. 원문과 발음을 비교해서 일치 %를 알려 줘요. 한자가 달라도 소리가 같으면 정답이에요. 내 목소리를 녹음해서 들어 볼 수도 있어요." },
    { kind: 'improve', title: '보통 난이도 빈칸 개선', body: '답이 길면 입력칸이 좁아 글자가 잘리던 문제, 단어 중간에서 빈칸이 끊기던 문제, 조사까지 한 빈칸에 묶이던 문제를 고쳤어요.' },
    { kind: 'improve', title: '결과 화면 자동 스크롤이 처음부터 켜져요', body: '노래를 들으며 확인할 때 화면이 부르는 문장을 따라 내려가요. 직접 끈 기기에서는 꺼진 채로 기억해요.' },
  ] as NewsEntry[],
}

/** 관리자: 소식이 비어 있을 때 블로그 업데이트 내역으로 한 번에 채우기 */
function StarterButton() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fill = async () => {
    setBusy(true)
    setErr('')
    try {
      await postNews(STARTER)
    } catch {
      setErr('넣지 못했어요. Firebase 보안 규칙에 news 부분이 들어갔는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-4">
      <button onClick={fill} disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/5 px-4 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}11월 7일 업데이트 내역 넣기
      </button>
      <p className="mt-2 text-xs text-muted-foreground">블로그에 올린 업데이트 내역(새 기능 3개, 개선 2개)이 글 하나로 들어가요.</p>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  )
}

/** 관리자: 새 패치 노트 올리기 (제목 + 여러 줄) */
function NewsForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState(dayTitle(Date.now()))
  const [items, setItems] = useState<NewsEntry[]>([{ kind: 'new', title: '', body: '', link: null }])
  const [blog, setBlog] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const okBlog = !blog.trim() || /^https:\/\//.test(blog.trim())
  const filled = items.filter((i) => i.title.trim())
  const set = (k: number, patch: Partial<NewsEntry>) => setItems((xs) => xs.map((x, j) => (j === k ? { ...x, ...patch } : x)))
  const submit = async () => {
    setBusy(true)
    setErr('')
    try {
      await postNews({ title: title.trim(), items: filled, blog: blog.trim() || null })
      onDone()
    } catch {
      setErr('올리지 못했어요. Firebase 보안 규칙에 news 부분이 들어갔는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  const input = 'w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring'
  return (
    <div className="hint-pop mt-4 rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-semibold">새 소식 올리기</p>
      <label className="mt-2 block text-xs text-muted-foreground">글 제목<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} className={`${input} mt-1 h-10`} /></label>

      <p className="mt-3 text-xs text-muted-foreground">바뀐 내용</p>
      <div className="mt-1 flex flex-col gap-2">
        {items.map((it, k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-1.5">
              {KIND_ORDER.map((kd) => (
                <button key={kd} onClick={() => set(k, { kind: kd })} className={`h-7 rounded-full border px-2.5 text-[11px] font-semibold ${it.kind === kd ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>{KIND[kd].label}</button>
              ))}
              {items.length > 1 && (
                <button onClick={() => setItems((xs) => xs.filter((_, j) => j !== k))} className="ml-auto grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="이 줄 지우기"><Trash2 className="size-3.5" /></button>
              )}
            </div>
            <input value={it.title} onChange={(e) => set(k, { title: e.target.value })} maxLength={60} placeholder="예) 따라 말하기" className={`${input} mt-2 h-9`} />
            <textarea value={it.body} onChange={(e) => set(k, { body: e.target.value })} maxLength={400} rows={2} placeholder="짧은 설명 (선택)" className={`${input} mt-1.5 py-1.5 leading-6`} />
            <select value={it.link ?? ''} onChange={(e) => set(k, { link: (e.target.value || null) as NewsLink | null })} className={`${input} mt-1.5 h-9`}>
              <option value="">바로 가기 버튼 없음</option>
              {(Object.keys(LINK_LABEL) as NewsLink[]).filter((l) => l !== 'progress').map((l) => <option key={l} value={l}>{LINK_LABEL[l]}</option>)}
            </select>
          </div>
        ))}
        <button onClick={() => setItems((xs) => [...xs, { kind: 'improve', title: '', body: '', link: null }])} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:bg-muted"><Plus className="size-3.5" />줄 추가</button>
      </div>

      <label className="mt-3 block text-xs text-muted-foreground">블로그 글 링크 (선택)<input value={blog} onChange={(e) => setBlog(e.target.value)} placeholder="https://blog.naver.com/…" className={`${input} mt-1 h-10`} /></label>
      {!okBlog && <p className="mt-1 text-xs text-destructive">https:// 로 시작하는 주소를 넣어 주세요.</p>}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={onDone} className="h-10 flex-1 rounded-xl border border-border text-sm hover:bg-muted">취소</button>
        <button onClick={submit} disabled={busy || !title.trim() || !filled.length || !okBlog} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy && <Loader2 className="size-4 animate-spin" />}올리기
        </button>
      </div>
    </div>
  )
}
