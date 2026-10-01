// Fuzzy file-path matching for Quick Open (Ctrl/Cmd+P), VS Code style:
// query characters must appear in order; matches at word starts (after "/",
// "-", "_", ".", a space, or a camelCase hump), consecutive runs and matches
// inside the file name score higher. Space-separated terms must all match.

export interface FuzzyMatch {
  score: number
  // Matched character indexes into the path, ascending, without duplicates.
  positions: number[]
}

export interface RankedPath extends FuzzyMatch {
  path: string
}

export interface QuickOpenQuery {
  text: string
  // 1-based line from a trailing ":<line>" (":<line>:<col>" also accepted).
  line?: number
}

const SEPARATORS = "/-_. "
// Starting positions tried per term. Each start is a greedy left-to-right
// match; trying the first few occurrences finds word-start and contiguous
// matches the leftmost one would miss.
const MAX_STARTS = 12

function isWordStart(path: string, i: number) {
  if (i === 0) return true
  const prev = path[i - 1]
  if (SEPARATORS.includes(prev)) return true
  const ch = path[i]
  return prev >= "a" && prev <= "z" && ch >= "A" && ch <= "Z"
}

// Characters of `query` appear in `text` in order.
function isSubsequence(query: string, text: string) {
  let i = 0
  for (let j = 0; j < text.length && i < query.length; j++) if (text[j] === query[i]) i++
  return i === query.length
}

// Greedy match of `term` in `lower` from `start`, scored. null when the rest
// of the term doesn't fit after `start`.
function matchFrom(term: string, path: string, lower: string, nameStart: number, start: number): FuzzyMatch | null {
  const positions: number[] = []
  let score = 0
  let prev = -2
  let j = start
  for (let i = 0; i < term.length; i++) {
    while (j < lower.length && lower[j] !== term[i]) j++
    if (j === lower.length) return null
    let s = 1
    if (j === prev + 1) s += 5
    if (isWordStart(path, j)) s += 6
    if (j >= nameStart) s += 2
    if (j === nameStart) s += 4
    // Gaps cost a little, capped so long paths aren't buried.
    if (prev >= 0) s -= Math.min(j - prev - 1, 4) * 0.5
    score += s
    positions.push(j)
    prev = j
    j++
  }
  return { score, positions }
}

function matchTerm(term: string, path: string, lower: string, nameStart: number): FuzzyMatch | null {
  if (!isSubsequence(term, lower)) return null
  let best: FuzzyMatch | null = null
  let tried = 0
  for (let start = lower.indexOf(term[0]); start !== -1 && tried < MAX_STARTS; start = lower.indexOf(term[0], start + 1)) {
    tried++
    const m = matchFrom(term, path, lower, nameStart, start)
    if (!m) break
    if (!best || m.score > best.score) best = m
  }
  // The whole term inside the file name beats any scattered match.
  const inName = lower.indexOf(term, nameStart)
  if (inName !== -1) {
    const m = matchFrom(term, path, lower, nameStart, inName)
    if (m && (!best || m.score > best.score)) best = m
  }
  return best
}

// Splits the query into lowercase terms (whitespace-separated).
export function queryTerms(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean)
}

// Scores `path` against already-lowercased `terms`; null when any term misses.
export function fuzzyMatch(terms: string[], path: string): FuzzyMatch | null {
  if (terms.length === 0) return null
  const lower = path.toLowerCase()
  const nameStart = path.lastIndexOf("/") + 1
  let score = 0
  const positions = new Set<number>()
  for (const term of terms) {
    const m = matchTerm(term, path, lower, nameStart)
    if (!m) return null
    score += m.score
    for (const p of m.positions) positions.add(p)
  }
  return { score, positions: [...positions].sort((a, b) => a - b) }
}

// Best matches first; ties go to shorter paths, then alphabetical order.
// An empty query matches nothing (the caller shows its own default list).
export function rankPaths(paths: readonly string[], text: string, limit = 50): RankedPath[] {
  const terms = queryTerms(text)
  if (terms.length === 0) return []
  const ranked: RankedPath[] = []
  for (const path of paths) {
    const m = fuzzyMatch(terms, path)
    if (m) ranked.push({ path, ...m })
  }
  ranked.sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.path.localeCompare(b.path))
  return ranked.slice(0, limit)
}

// "src/a.ts:42" → { text: "src/a.ts", line: 42 }. A ":" not followed by a
// line number stays part of the text.
export function parseQuery(query: string): QuickOpenQuery {
  const match = /^(.*?):(\d+)(?::\d+)?\s*$/.exec(query.trim())
  if (!match) return { text: query.trim() }
  const line = Number(match[2])
  return line > 0 ? { text: match[1], line } : { text: match[1] }
}

export interface PathSegment {
  text: string
  match: boolean
}

// Splits path[from, to) into matched / unmatched runs for highlighting.
export function matchSegments(path: string, positions: readonly number[], from = 0, to = path.length): PathSegment[] {
  const marked = new Set(positions)
  const segments: PathSegment[] = []
  for (let i = from; i < to; i++) {
    const match = marked.has(i)
    const last = segments[segments.length - 1]
    if (last && last.match === match) last.text += path[i]
    else segments.push({ text: path[i], match })
  }
  return segments
}
