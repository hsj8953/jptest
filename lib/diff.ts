export type DiffChar = { c: string; bad?: boolean }

/** 글자 단위 비교(LCS). bad=true 인 글자가 서로 다른 부분이에요. */
export function diffChars(answer: string, input: string) {
  const A = Array.from(answer)
  const B = Array.from(input)
  const n = A.length
  const m = B.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const ans: DiffChar[] = []
  const inp: DiffChar[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      ans.push({ c: A[i++] })
      inp.push({ c: B[j++] })
    } else if (dp[i + 1][j] >= dp[i][j + 1]) ans.push({ c: A[i++], bad: true })
    else inp.push({ c: B[j++], bad: true })
  }
  while (i < n) ans.push({ c: A[i++], bad: true })
  while (j < m) inp.push({ c: B[j++], bad: true })
  return { ans, inp }
}
