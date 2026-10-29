'use client'

// 브라우저 → 우리 서버(/api/…) AI 요청 공통 코드
// 무료 Gemini는 붐비거나 한도에 걸리기 쉬워서, 잠깐 기다렸다가 자동으로 다시 시도해요.

export type AiError = Error & { code: string; detail?: string }

const RETRYABLE = new Set(['busy', 'rate_limited', 'timeout', 'ai_failed'])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function postAi<T>(url: string, body: unknown, token: string, onWait?: (sec: number) => void): Promise<T> {
  let lastErr: AiError | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      // 한도 초과면 조금 더 길게 기다려요
      const wait = lastErr?.code === 'rate_limited' ? 10 : attempt === 1 ? 3 : 6
      onWait?.(wait)
      await sleep(wait * 1000)
    }
    let res: Response
    try {
      res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    } catch {
      lastErr = Object.assign(new Error('timeout'), { code: 'timeout', detail: '인터넷 연결 확인' })
      continue
    }
    const text = await res.text()
    let json: (T & { error?: string; detail?: string }) | null = null
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
    if (res.ok && json && !json.error) return json
    const code = json?.error ?? (res.status === 502 || res.status === 504 ? 'timeout' : 'ai_failed')
    lastErr = Object.assign(new Error(code), { code, detail: json?.detail ?? `서버 응답 ${res.status}` })
    if (!RETRYABLE.has(code)) break
  }
  throw lastErr ?? Object.assign(new Error('ai_failed'), { code: 'ai_failed' })
}
