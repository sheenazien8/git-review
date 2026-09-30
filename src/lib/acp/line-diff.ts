// Turns an ACP tool-call diff ({ oldText, newText }) into unified diff text,
// so it renders with the same DiffView as git diffs.

type Op = { type: " " | "-" | "+"; line: string }

// Above this many LCS cells the diff degrades to "all removed, all added".
const MAX_CELLS = 4_000_000

function splitText(text: string | null | undefined): string[] {
  if (!text) return []
  return text.replace(/\n$/, "").split("\n")
}

function diffLines(a: string[], b: string[]): Op[] {
  // Common prefix/suffix never need the LCS table.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const head: Op[] = a.slice(0, start).map(line => ({ type: " ", line }))
  const tail: Op[] = a.slice(endA).map(line => ({ type: " ", line }))
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const n = midA.length
  const m = midB.length

  let middle: Op[]
  if (n * m > MAX_CELLS) {
    middle = [...midA.map(line => ({ type: "-" as const, line })), ...midB.map(line => ({ type: "+" as const, line }))]
  } else {
    // lcs[i][j] = LCS length of midA[i..] and midB[j..]
    const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
      }
    }
    middle = []
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        middle.push({ type: " ", line: midA[i] })
        i++
        j++
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
        middle.push({ type: "-", line: midA[i++] })
      } else {
        middle.push({ type: "+", line: midB[j++] })
      }
    }
    while (i < n) middle.push({ type: "-", line: midA[i++] })
    while (j < m) middle.push({ type: "+", line: midB[j++] })
  }
  return [...head, ...middle, ...tail]
}

export function unifiedDiff(oldText: string | null | undefined, newText: string, context = 3): string {
  const ops = diffLines(splitText(oldText), splitText(newText))
  const changed = ops.flatMap((op, i) => (op.type === " " ? [] : [i]))
  if (changed.length === 0) return ""

  // Group changes whose context windows touch into one hunk.
  const ranges: [number, number][] = []
  for (const i of changed) {
    const from = Math.max(0, i - context)
    const to = Math.min(ops.length - 1, i + context)
    const last = ranges[ranges.length - 1]
    if (last && from <= last[1] + 1) last[1] = to
    else ranges.push([from, to])
  }

  // Line numbers (1-based) at the start of every op.
  const oldNo: number[] = []
  const newNo: number[] = []
  let o = 1
  let n = 1
  for (const op of ops) {
    oldNo.push(o)
    newNo.push(n)
    if (op.type !== "+") o++
    if (op.type !== "-") n++
  }

  const out: string[] = []
  for (const [from, to] of ranges) {
    const slice = ops.slice(from, to + 1)
    const oldCount = slice.filter(op => op.type !== "+").length
    const newCount = slice.filter(op => op.type !== "-").length
    // Like git, an empty side starts at the line before it (0 for a new file).
    const oldStart = oldCount === 0 ? oldNo[from] - 1 : oldNo[from]
    const newStart = newCount === 0 ? newNo[from] - 1 : newNo[from]
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`)
    for (const op of slice) out.push(op.type + op.line)
  }
  return out.join("\n") + "\n"
}
