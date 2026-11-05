'use client'

// 문장 풀이 만들기 (관리자): 몇 줄씩 나눠서 Gemini에 보내요. 실패한 줄은 비워 두고 다시 누르면 빈 것만 채워요.
import { getFirebaseAuth } from './firebase'
import { postAi, type AiError } from './ai-client'
import { answerOf } from './ruby'
import type { Line, LineExplain } from './types'

const CHUNK = 4

export async function generateExplain(lines: Line[], onProgress?: (done: number, total: number, note?: string) => void) {
  const out: (LineExplain | undefined)[] = lines.map((l) => l.explain)
  // 가사가 있고 아직 풀이가 없는 줄만
  const need = lines.map((l, i) => (!l.explain && answerOf(l.ruby) ? i : -1)).filter((i) => i >= 0)
  let error: string | undefined
  let detail: string | undefined
  let failed = 0
  const token = await getFirebaseAuth().currentUser?.getIdToken()
  if (!token) return { explains: out, error: 'unauthorized', detail: '', failed: need.length, total: need.length }
  let done = 0
  onProgress?.(0, need.length)
  for (let s = 0; s < need.length; s += CHUNK) {
    const part = need.slice(s, s + CHUNK)
    try {
      const json = await postAi<{ lines: (LineExplain | null)[] }>(
        '/api/explain',
        { items: part.map((i) => ({ ja: answerOf(lines[i].ruby), ko: lines[i].ko })) },
        token,
        (sec) => onProgress?.(done, need.length, `Gemini가 바빠서 ${sec}초 뒤 다시 시도해요…`),
      )
      json.lines.forEach((r, j) => {
        if (r) out[part[j]] = r
        else failed++
      })
    } catch (e) {
      failed += part.length
      error ??= (e as AiError).code ?? (e as Error).message
      detail ??= (e as AiError).detail
    } finally {
      done += part.length
      onProgress?.(done, need.length)
    }
  }
  return { explains: out, error, detail, failed, total: need.length }
}
