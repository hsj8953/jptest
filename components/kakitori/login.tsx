import { BookOpen, Headphones, PenLine, Users } from 'lucide-react'
import { DictationDemo, FloatingKana } from './login-demo'
import { Button } from '@/components/ui/button'

export function Login({ onLogin, busy, error }: { onLogin: () => void; busy?: boolean; error?: string }) {
  return (
    <main className="login-bg relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <FloatingKana />
      <div className="relative w-full max-w-sm text-center">
        <div className="login-rise mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-xl" style={{ animationDelay: '0ms' }}>
          <BookOpen className="size-8" />
        </div>
        <h1 className="login-rise mt-6 text-3xl font-bold tracking-tight" style={{ animationDelay: '80ms' }}>카키토리 노트</h1>
        <p className="login-rise mt-1 font-jp text-sm text-muted-foreground" style={{ animationDelay: '140ms' }}>
          <ruby>書<rt>か</rt></ruby>き<ruby>取<rt>と</rt></ruby>りノート
        </p>

        <div className="login-rise mt-8" style={{ animationDelay: '220ms' }}>
          <DictationDemo />
        </div>

        <ul className="login-rise mt-6 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground" style={{ animationDelay: '300ms' }}>
          <li className="flex flex-col items-center gap-1 rounded-xl bg-card/70 px-2 py-2.5 backdrop-blur"><Headphones className="size-4 text-primary" />구간 반복 듣기</li>
          <li className="flex flex-col items-center gap-1 rounded-xl bg-card/70 px-2 py-2.5 backdrop-blur"><PenLine className="size-4 text-primary" />한 글자씩 채점</li>
          <li className="flex flex-col items-center gap-1 rounded-xl bg-card/70 px-2 py-2.5 backdrop-blur"><Users className="size-4 text-primary" />친구와 기록 비교</li>
        </ul>

        <div className="login-rise" style={{ animationDelay: '380ms' }}>
          <Button onClick={onLogin} disabled={busy} className="mt-8 h-12 w-full bg-white text-base text-slate-800 shadow-md ring-1 ring-border hover:bg-slate-100 hover:shadow-lg">
            <GoogleIcon />{busy ? '로그인 중…' : '구글로 로그인'}
          </Button>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <p className="mt-5 text-xs text-muted-foreground">초대받은 친구와 관리자만 이용할 수 있어요.</p>
        </div>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="mr-2 size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Firebase 로그인을 붙이면, 초대 목록에 없는 계정에게 보여줄 화면 */
export function NotInvited({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-bold">아직 초대되지 않은 계정이에요</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">관리자에게 아래 이메일을 초대 목록에 넣어달라고 말해 주세요. 추가된 뒤 새로고침하면 들어갈 수 있어요.</p>
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 font-mono text-sm">{email}</p>
        <Button variant="outline" onClick={onLogout} className="mt-6 w-full">다른 계정으로 로그인</Button>
      </div>
    </main>
  )
}

/** .env.local 이 없을 때 보여주는 안내 */
export function SetupNeeded() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">Firebase 설정이 필요해요</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          프로젝트 폴더의 <code className="rounded bg-muted px-1">.env.example</code> 을 복사해 <code className="rounded bg-muted px-1">.env.local</code> 로 이름을 바꾸고,
          Firebase 콘솔의 firebaseConfig 값과 관리자 이메일을 채운 뒤 <code className="rounded bg-muted px-1">npm run dev</code> 를 다시 실행해 주세요.
        </p>
      </div>
    </main>
  )
}
