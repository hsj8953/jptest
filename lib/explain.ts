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

/** 예문을 붙일 단어: 조사·조동사·접미사·기호 같은 건 빼요 (뻔하고 시간만 걸려서) */
// 품사 이름이 '격조사', '조사(주격)'처럼 조금 달라도 걸러지게 글자가 들어 있는지로 봐요
const NO_EX_POS = /조사|조동사|접미사|접두사|기타|기호/
// 품사가 비어 있거나 틀려도: 가나 1~2글자짜리 조사·어미(は に を で が も と へ の や か ね よ た て だ…)는 빼요
const SHORT_KANA = /^[ぁ-ゖー]{1,2}$/
// (もう·まだ 같은 짧은 부사처럼 품사가 내용어로 분명히 적힌 건 남겨요)
const CONTENT_POS = /명사|동사|형용|부사|감탄사|연체사|접속사/
export const wantsExample = (w: { w: string; pos: string }) =>
  !NO_EX_POS.test(w.pos ?? '') && !(SHORT_KANA.test(w.w) && !CONTENT_POS.test(w.pos ?? '')) && /[\p{L}]/u.test(w.w)

/** 예문이 하나라도 빠진 풀이인지 */
export const needsExamples = (ex?: LineExplain) => !!ex && (ex.words.some((w) => wantsExample(w) && !w.ex) || ex.grammar.some((g) => !g.ex))

/** 문장 풀이의 단어·문법마다 실생활 예문 채우기 (이미 있는 예문은 그대로 둬요)
 *  - 3문장씩 묶어서 3묶음을 한꺼번에 보내요 (하나씩 기다리면 너무 오래 걸려서) */
export async function generateExamples(lines: Line[], onProgress?: (done: number, total: number, note?: string) => void) {
  const out: (LineExplain | undefined)[] = lines.map((l) => l.explain)
  const need = lines.map((l, i) => (needsExamples(l.explain) ? i : -1)).filter((i) => i >= 0)
  let error: string | undefined
  let detail: string | undefined
  let failed = 0
  const token = await getFirebaseAuth().currentUser?.getIdToken()
  if (!token) return { explains: out, error: 'unauthorized', detail: '', failed: need.length, total: need.length }
  const EX_CHUNK = 3
  const PARALLEL = 3
  const chunks: number[][] = []
  for (let s = 0; s < need.length; s += EX_CHUNK) chunks.push(need.slice(s, s + EX_CHUNK))
  let done = 0
  onProgress?.(0, need.length)

  const runChunk = async (part: number[]) => {
    // 문장마다 예문이 필요한 단어만 보내고, 받은 걸 원래 자리에 돌려놔요
    const pick = part.map((i) => lines[i].explain!.words.map((w, k) => (wantsExample(w) && !w.ex ? k : -1)).filter((k) => k >= 0))
    try {
      const json = await postAi<{ items: ({ words: ({ ja: string; ko: string } | null)[]; grammar: ({ ja: string; ko: string } | null)[] } | null)[] }>(
        '/api/explain-examples',
        {
          items: part.map((i, j) => ({
            line: answerOf(lines[i].ruby),
            words: pick[j].map((k) => ({ w: lines[i].explain!.words[k].w, m: lines[i].explain!.words[k].m })),
            grammar: lines[i].explain!.grammar.map((g) => g.title),
          })),
        },
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
        const byIdx = new Map(pick[j].map((k, n) => [k, r.words[n]]))
        out[i] = {
          ...ex,
          words: ex.words.map((w, k) => (w.ex || !byIdx.get(k) ? w : { ...w, ex: byIdx.get(k)! })),
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
  // 동시에 3묶음까지
  let next = 0
  await Promise.all(Array.from({ length: Math.min(PARALLEL, chunks.length) }, async () => {
    while (next < chunks.length) await runChunk(chunks[next++])
  }))
  return { explains: out, error, detail, failed, total: need.length }
}
