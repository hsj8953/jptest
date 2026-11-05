'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Music2, PartyPopper, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actions, useStore, type SongRequest } from '@/lib/store'
import { parseYouTubeId } from '@/lib/youtube'
import { isTimed } from '@/lib/wrong'

/** 화면 가운데 뜨는 창 */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="hint-pop max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="ml-auto grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="닫기">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const field = 'mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring'

/** 친구: 곡 신청 창 */
export function SongRequestModal({ onClose }: { onClose: () => void }) {
  const { songs } = useStore()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const id = parseYouTubeId(url)
  const exists = id ? songs.find((s) => s.youtubeId === id) : undefined
  const canSend = !!id && !exists && !!title.trim() && !busy

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSend || !id) return
    setBusy(true)
    setError('')
    try {
      await actions.requestSong(id, title, artist)
      setDone(true)
    } catch {
      setError('신청하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Modal title="곡 신청" onClose={onClose}>
        <div className="py-4 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Check className="size-6" /></span>
          <p className="mt-3 font-semibold">신청했어요!</p>
          <p className="mt-1 text-sm text-muted-foreground">관리자가 곡을 추가하면 곡 목록에서 알려 드릴게요.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={() => { setDone(false); setUrl(''); setTitle(''); setArtist('') }}><Plus data-icon="inline-start" />한 곡 더</Button>
            <Button onClick={onClose}>닫기</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="곡 신청" onClose={onClose}>
      <form onSubmit={send} className="flex flex-col gap-4">
        <label className="text-sm font-semibold">
          유튜브 주소 <span className="text-destructive">*</span>
          <input id="req-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/..." className={field} />
        </label>
        {url.trim() && !id && <p className="-mt-2 text-xs text-destructive">유튜브 주소 형식이 아니에요.</p>}
        {id && (
          <div className="-mt-1 flex items-center gap-3 rounded-xl bg-muted/50 p-2">
            <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="aspect-video w-28 shrink-0 rounded-lg object-cover" />
            {exists ? (
              <p className="text-sm">
                <b className="text-primary">이미 있는 곡이에요.</b>
                <span className="mt-0.5 block font-jp text-xs text-muted-foreground">{exists.title}{exists.artist ? ` · ${exists.artist}` : ''}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">이 영상이 맞는지 확인해 주세요.</p>
            )}
          </div>
        )}
        <label className="text-sm font-semibold">
          노래 제목 <span className="text-destructive">*</span>
          <input id="req-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="예: 夜に駆ける" className={`${field} font-jp`} />
        </label>
        <label className="text-sm font-semibold">
          가수 <span className="font-normal text-muted-foreground">(선택)</span>
          <input id="req-artist" value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={60} placeholder="예: YOASOBI" className={field} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={!canSend}>{busy && <Loader2 className="animate-spin" data-icon="inline-start" />}신청하기</Button>
        </div>
      </form>
    </Modal>
  )
}

/** 관리자: 신청 목록 창 */
export function SongRequestList({ onClose, onRegister }: { onClose: () => void; onRegister: (r: SongRequest) => void }) {
  const { songRequests } = useStore()
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  return (
    <Modal title={`곡 신청 목록 (${songRequests.length})`} onClose={onClose}>
      {songRequests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">기다리는 신청이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {songRequests.map((r) => (
            <div key={r.id} className="rounded-xl bg-muted/50 p-2.5">
              <div className="flex gap-3">
                <a href={`https://youtu.be/${r.youtubeId}`} target="_blank" rel="noreferrer" className="shrink-0" title="유튜브에서 보기">
                  <img src={`https://i.ytimg.com/vi/${r.youtubeId}/mqdefault.jpg`} alt="" className="aspect-video w-24 rounded-lg object-cover" />
                </a>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-jp text-sm font-semibold">{r.title || '(제목 없음)'}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.artist || '가수 미입력'}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">신청: {r.requesters.map((x) => x.name || '친구').join(', ')}</p>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-1.5">
                {confirmDel === r.id ? (
                  <>
                    <span className="mr-auto self-center text-xs text-muted-foreground">목록에서 지울까요? (친구에게 알림은 안 가요)</span>
                    <Button size="sm" variant="outline" onClick={() => setConfirmDel(null)}>취소</Button>
                    <Button size="sm" variant="destructive" onClick={() => actions.deleteSongRequest(r.id).catch(() => {})}>지우기</Button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setConfirmDel(r.id)} className="inline-flex items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-3.5" />목록에서 지우기</button>
                    <Button size="sm" onClick={() => onRegister(r)}><Music2 data-icon="inline-start" />등록하기</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

/** 친구: 내가 신청한 곡이 추가되면 곡 목록 위에 알림 */
export function AddedNotice({ onOpen }: { onOpen: (songId: string) => void }) {
  const { songRequests, seenAdded, songs } = useStore()
  // 타이밍까지 다 찍혀서 실제로 공부할 수 있게 된 뒤에 알려요
  const fresh = songRequests.filter((r) => r.status === 'added' && !seenAdded.includes(r.id) && songs.some((s) => s.id === r.songId && isTimed(s)))
  if (!fresh.length) return null
  const first = fresh[0]
  const name = songs.find((s) => s.id === first.songId)?.title ?? first.songTitle ?? first.title
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-700/50 dark:bg-emerald-950/40">
      <PartyPopper className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <button className="min-w-0 flex-1 text-left" onClick={() => { actions.dismissAdded(fresh.map((r) => r.id)).catch(() => {}); if (first.songId) onOpen(first.songId) }}>
        신청한 <b className="font-jp">{name}</b>{fresh.length > 1 ? ` 외 ${fresh.length - 1}곡이` : '이(가)'} 추가됐어요! <span className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300">바로 공부하기 →</span>
      </button>
      <button onClick={() => actions.dismissAdded(fresh.map((r) => r.id)).catch(() => {})} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground" aria-label="알림 닫기">
        <X className="size-4" />
      </button>
    </div>
  )
}
