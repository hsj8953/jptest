'use client'

// 문장 풀이 만들기 (관리자): 몇 줄씩 나눠서 Gemini에 보내요. 실패한 줄은 비워 두고 다시 누르면 빈 것만 채워요.
import { getFirebaseAuth } from './firebase'
import { postAi, type AiError } from './ai-client'
import { answerOf } from './ruby'
import type { Line, LineExplain } from './types'

const CHUNK = 8

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

/** 예문이 하나라도 빠진 풀이인지 */
export const needsExamples = (ex?: LineExplain) => !!ex && (ex.words.some((w) => !w.ex) || ex.grammar.some((g) => !g.ex))

/** 문장 풀이의 단어·문법마다 실생활 예문 채우기 (이미 있는 예문은 그대로 둬요) */
export async function generateExamples(lines: Line[], onProgress?: (done: number, total: number, note?: string) => void) {
  const out: (LineExplain | undefined)[] = lines.map((l) => l.explain)
  const need = lines.map((l, i) => (needsExamples(l.explain) ? i : -1)).filter((i) => i >= 0)
  let error: string | undefined
  let detail: string | undefined
  let failed = 0
  const token = await getFirebaseAuth().currentUser?.getIdToken()
  if (!token) return { explains: out, error: 'unauthorized', detail: '', failed: need.length, total: need.length }
  const EX_CHUNK = 5
  let done = 0
  onProgress?.(0, need.length)
  for (let s = 0; s < need.length; s += EX_CHUNK) {
    const part = need.slice(s, s + EX_CHUNK)
    try {
      const json = await postAi<{ items: ({ words: ({ ja: string; ko: string } | null)[]; grammar: ({ ja: string; ko: string } | null)[] } | null)[] }>(
        '/api/explain-examples',
        { items: part.map((i) => ({ line: answerOf(lines[i].ruby), words: lines[i].explain!.words.map((w) => ({ w: w.w, m: w.m })), grammar: lines[i].explain!.grammar.map((g) => g.title) })) },
        token,
        (sec) => onProgress?.(done, need.length, `Gemini가 바빠서 ${sec}초 뒤 다시 시도해요…`),
      )
      json.items.forEach((r, j) => {
        const i = part[j]
        const ex = out[i]!
        if (!r) {
          failed++
          return
        }
        out[i] = {
          ...ex,
          words: ex.words.map((w, k) => (w.ex || !r.words[k] ? w : { ...w, ex: r.words[k]! })),
          grammar: ex.grammar.map((g, k) => (g.ex || !r.grammar[k] ? g : { ...g, ex: r.grammar[k]! })),
        }
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
