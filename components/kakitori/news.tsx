'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Bell, ExternalLink, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { deleteNews, postNews, useStore, type NewsItem, type NewsKind, type NewsLink } from '@/lib/store'

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
/** 안 읽은 소식 수 */
export function useUnreadNews() {
  const { news } = useStore()
  const seen = useSyncExternalStore(subscribeSeen, getSeen, () => Number.MAX_SAFE_INTEGER)
  return news.filter((n) => n.createdAt > seen)
}

const KIND: Record<NewsKind, { label: string; c: string }> = {
  new: { label: '새 기능', c: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' },
  improve: { label: '개선', c: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  fix: { label: '수정', c: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300' },
}
export const LINK_LABEL: Record<NewsLink, string> = { stamps: '도장 수첩 열기', vocab: '단어장 열기', wrong: '오답 노트 열기', help: '사용법 보기', progress: '학습 현황 열기' }
const fmt = (ms: number) => new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })

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

/** 곡 목록 맨 위: 가장 최근 새 소식 한 줄 */
export function NewsBanner({ onOpen }: { onOpen: () => void }) {
  const unread = useUnreadNews()
  const top = unread[0]
  if (!top) return null
  return (
    <div className="hint-pop mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#2f3a56] text-[#f2b84b]"><Sparkles className="size-4" /></span>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <b className="block truncate text-sm">{KIND[top.kind]?.label ?? '소식'}: {top.title}</b>
        <span className="block truncate text-xs text-muted-foreground">{unread.length > 1 ? `새 소식이 ${unread.length}개 있어요` : top.body}</span>
      </button>
      <button onClick={onOpen} className="shrink-0 text-xs font-semibold text-primary hover:underline">보기 →</button>
      <button onClick={() => markNewsSeen(top.createdAt)} className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="알림 닫기"><X className="size-4" /></button>
    </div>
  )
}

/** 업데이트 소식 창 */
export function NewsModal({ isAdmin, onClose, onLink }: { isAdmin: boolean; onClose: () => void; onLink: (l: NewsLink) => void }) {
  const { news } = useStore()
  // 열 때의 '읽은 시각'으로 NEW를 표시하고, 열자마자 다 읽은 걸로 해요
  const [seenAtOpen] = useState(getSeen)
  const [all, setAll] = useState(false)
  const [writing, setWriting] = useState(false)
  useEffect(() => {
    if (news[0]) markNewsSeen(news[0].createdAt)
  }, [news])
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

  const fresh = news.filter((n) => n.createdAt > seenAtOpen)
  // 새 소식은 펼쳐서, 지난 소식은 제목만. 새 소식이 없으면 최근 2개를 펼쳐요
  const openCount = Math.max(fresh.length, Math.min(2, news.length))
  const shown = all ? news : news.slice(0, Math.max(openCount + 3, 5))

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

        {news.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">아직 올라온 소식이 없어요.</p>
        ) : (
          <ul className="mt-3">
            {shown.map((n, i) => {
              const isNew = n.createdAt > seenAtOpen
              const open = i < openCount
              return (
                <li key={n.id} className="border-t border-border py-3.5 first:border-0">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {isNew && <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-4 text-white">NEW</span>}
                    {fmt(n.createdAt)}
                    {isAdmin && (
                      <button
                        onClick={() => window.confirm(`'${n.title}' 소식을 지울까요? 되돌릴 수 없어요.`) && deleteNews(n.id)}
                        className="ml-auto grid size-6 place-items-center rounded text-muted-foreground/70 hover:bg-muted hover:text-destructive"
                        aria-label="소식 지우기"
                      ><Trash2 className="size-3.5" /></button>
                    )}
                  </p>
                  <h3 className={`mt-1 font-bold ${open ? 'text-base' : 'text-sm'}`}>
                    <span className={`mr-1.5 inline-block rounded-md px-1.5 py-px align-[1px] text-[11px] font-bold ${KIND[n.kind]?.c ?? 'bg-muted'}`}>{KIND[n.kind]?.label ?? '소식'}</span>
                    {n.title}
                  </h3>
                  {open && n.body && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{n.body}</p>}
                  {open && (n.link || n.blog) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {n.link && LINK_LABEL[n.link] && (
                        <button onClick={() => onLink(n.link!)} className="rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/5">{LINK_LABEL[n.link]} →</button>
                      )}
                      {n.blog && (
                        <a href={n.blog} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted">블로그에서 자세히<ExternalLink className="size-3" /></a>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!all && news.length > shown.length && (
          <button onClick={() => setAll(true)} className="mt-1 w-full rounded-lg py-2 text-sm text-muted-foreground hover:bg-muted">지난 소식 더 보기</button>
        )}
      </div>
    </div>
  )
}

/** 관리자: 새 소식 올리기 */
function NewsForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<NewsKind>('new')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState<NewsLink | ''>('')
  const [blog, setBlog] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const okBlog = !blog.trim() || /^https:\/\//.test(blog.trim())
  const submit = async () => {
    setBusy(true)
    setErr('')
    try {
      await postNews({ kind, title: title.trim(), body: body.trim(), link: link || null, blog: blog.trim() || null })
      onDone()
    } catch {
      setErr('올리지 못했어요. Firebase 보안 규칙에 news 부분이 들어갔는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  const input = 'mt-1 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring'
  return (
    <div className="hint-pop mt-4 rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-semibold">새 소식 올리기</p>
      <div className="mt-2 flex gap-1.5">
        {(Object.keys(KIND) as NewsKind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`h-8 rounded-full border px-3 text-xs font-semibold ${kind === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}>{KIND[k].label}</button>
        ))}
      </div>
      <label className="mt-3 block text-xs text-muted-foreground">제목<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="예) 따라 말하기" className={`${input} h-10`} /></label>
      <label className="mt-2 block text-xs text-muted-foreground">내용<textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={400} rows={3} placeholder="친구들에게 보여 줄 짧은 설명" className={`${input} py-2 leading-6`} /></label>
      <label className="mt-2 block text-xs text-muted-foreground">바로 가기 버튼 (선택)
        <select value={link} onChange={(e) => setLink(e.target.value as NewsLink | '')} className={`${input} h-10`}>
          <option value="">없음</option>
          {(Object.keys(LINK_LABEL) as NewsLink[]).filter((k) => k !== 'progress').map((k) => <option key={k} value={k}>{LINK_LABEL[k]}</option>)}
        </select>
      </label>
      <label className="mt-2 block text-xs text-muted-foreground">블로그 글 링크 (선택)<input value={blog} onChange={(e) => setBlog(e.target.value)} placeholder="https://blog.naver.com/…" className={`${input} h-10`} /></label>
      {!okBlog && <p className="mt-1 text-xs text-destructive">https:// 로 시작하는 주소를 넣어 주세요.</p>}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={onDone} className="h-10 flex-1 rounded-xl border border-border text-sm hover:bg-muted">취소</button>
        <button onClick={submit} disabled={busy || !title.trim() || !okBlog} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy && <Loader2 className="size-4 animate-spin" />}올리기
        </button>
      </div>
    </div>
  )
}
