import { parseRuby } from '@/lib/ruby'

/** 漢字{かんじ} 표기를 <ruby>로 보여줘요 */
export function Furigana({ text }: { text: string }) {
  return (
    <span lang="ja">
      {parseRuby(text).map((p, i) =>
        p.reading ? (
          <ruby key={i}>
            {p.text}
            <rt className="text-[0.55em] text-muted-foreground">{p.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  )
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      ← 곡 목록
    </button>
  )
}
