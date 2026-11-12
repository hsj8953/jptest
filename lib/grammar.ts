// 문법 모음: 곡 해설(lines[].explain.grammar)에 들어 있는 문법을 곡에 상관없이 문법별로 모아요.
// AI가 쓴 제목이라 표기가 조금씩 달라서, 괄호 앞의 문법 이름으로 묶어요. 예) "～たら (~했더니)" · "~たら(~하면)" → ～たら

import { baseText } from './ruby'
import type { ExplainExample, Song } from './types'
import { isTimed } from './wrong'

export type GrammarHit = { song: Song; line: number; body: string }
export type GrammarEntry = {
  key: string
  name: string
  /** 뜻 (가장 많이 쓰인 것부터) */
  means: string[]
  body: string
  ex?: ExplainExample
  hits: GrammarHit[]
}

const clean = (t: string) => t.replace(/[~〜∼]/g, '～').replace(/[\s　]+/g, ' ').trim()

export function splitTitle(title: string) {
  const t = String(title ?? '').replace(/[\s\u3000]+/g, ' ').trim()
  const m = t.match(/^(.+?)\s*[（(](.+)[)）]\s*$/)
  // 문법 이름의 물결표는 ～로 통일하고, 한국어 뜻은 ~로 통일해요
  return m ? { name: clean(m[1]), mean: m[2].trim().replace(/[～〜∼]/g, '~') } : { name: clean(t), mean: '' }
}
export const grammarKey = (name: string) => clean(name).replace(/\s/g, '')

export function grammarIndex(songs: Song[], isAdmin: boolean): GrammarEntry[] {
  const map = new Map<string, GrammarEntry & { meanCount: Map<string, number>; seen: Set<string> }>()
  const sorted = [...songs].sort((a, b) => b.createdAt - a.createdAt)
  for (const song of sorted) {
    if (!isTimed(song) && !isAdmin) continue
    song.lines.forEach((l, line) => {
      for (const g of l.explain?.grammar ?? []) {
        if (!g?.title?.trim()) continue
        const { name, mean } = splitTitle(g.title)
        const key = grammarKey(name)
        if (!key) continue
        let e = map.get(key)
        if (!e) {
          e = { key, name, means: [], body: g.body ?? '', ex: g.ex, hits: [], meanCount: new Map(), seen: new Set() }
          map.set(key, e)
        }
        for (const m of mean.split(/\s*[,、/·]\s*/)) if (m) e.meanCount.set(m, (e.meanCount.get(m) ?? 0) + 1)
        if (!e.body && g.body) e.body = g.body
        if (!e.ex && g.ex?.ja) e.ex = g.ex
        const id = `${song.id}:${line}`
        if (!e.seen.has(id)) {
          e.seen.add(id)
          e.hits.push({ song, line, body: g.body ?? '' })
        }
      }
    })
  }
  return [...map.values()].map(({ meanCount, seen: _seen, ...e }) => ({
    ...e,
    means: [...meanCount.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m),
  }))
}

/** 가사 속에서 문법이 나온 자리 (읽기 표기를 뺀 글자 위치). 일본어 두 글자 이상일 때만 찾아요 */
export function grammarSpan(name: string, ruby: string): [number, number] | null {
  const core = name.replace(/[^぀-ヿ㐀-鿿々]/g, '')
  if (core.length < 2) return null
  const at = baseText(ruby).indexOf(core)
  return at < 0 ? null : [at, at + core.length]
}
