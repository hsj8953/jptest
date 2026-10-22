import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-xl"><BookOpen className="size-8" /></div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">카키토리 노트</h1>
        <p className="mt-1 font-jp text-sm text-muted-foreground">書き取りノート</p>
        <p className="mt-8 text-sm leading-7 text-muted-foreground">좋아하는 J-POP을 들으며<br />일본어 문장을 천천히 내 것으로 만들어요.</p>
        <Button onClick={onLogin} className="mt-8 h-12 w-full bg-white text-slate-800 shadow-sm ring-1 ring-border hover:bg-muted">
          <span className="mr-2 font-bold text-red-500">G</span>구글로 로그인
        </Button>
        <p className="mt-5 text-xs text-muted-foreground">초대받은 친구와 관리자만 이용할 수 있어요.</p>
      </div>
    </main>
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
