import type { RepoEntry } from "@/lib/git/types"

// `@path` file mentions in the agent prompt box: finding the one being
// typed, ranking suggestions, inserting a pick, and collecting what to
// attach on send. Paths are repo-relative; a mention ends at whitespace.

// Files that can be mentioned: the All Files listing minus what git
// ignores (.gitignore, .git/info/exclude, global excludes — an entry is
// "ignored" when git lists it as neither tracked nor untracked). Tracked
// files stay even if a pattern matches them, like in git. Outside a git
// repo every entry is "ignored", so all files are offered instead.
export function mentionableFiles(entries: RepoEntry[]): string[] {
  const files = entries.filter(e => e.type === "file")
  const known = files.filter(e => e.status !== "ignored")
  return (known.length > 0 ? known : files).map(e => e.path)
}

export interface ActiveMention {
  // Index of the "@"
  start: number
  // What is typed after it, up to the caret
  query: string
}

const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"`]+$/

// The mention the caret is in: an "@" at the start or after whitespace,
// followed by non-whitespace up to the caret.
export function mentionAt(text: string, caret: number): ActiveMention | null {
  const before = text.slice(0, caret)
  const match = /(^|\s)@(\S*)$/.exec(before)
  if (!match) return null
  return { start: caret - match[2].length - 1, query: match[2] }
}

function basename(path: string) {
  return path.slice(path.lastIndexOf("/") + 1)
}

// Characters of `query` appear in `text` in order.
function isSubsequence(query: string, text: string) {
  let i = 0
  for (let j = 0; j < text.length && i < query.length; j++) if (text[j] === query[i]) i++
  return i === query.length
}

// Best matches first: file name starts with the query, then contains it,
// then the path contains it, then a loose in-order match. Shorter paths
// win ties. An empty query lists files as given.
export function rankFiles(files: string[], query: string, limit = 50): string[] {
  const q = query.toLowerCase()
  if (!q) return files.slice(0, limit)
  const scored: { path: string; score: number }[] = []
  for (const path of files) {
    const p = path.toLowerCase()
    const name = basename(p)
    const score = name.startsWith(q) ? 0 : name.includes(q) ? 1 : p.includes(q) ? 2 : isSubsequence(q, p) ? 3 : -1
    if (score >= 0) scored.push({ path, score })
  }
  scored.sort((a, b) => a.score - b.score || a.path.length - b.path.length || a.path.localeCompare(b.path))
  return scored.slice(0, limit).map(s => s.path)
}

// Replaces text[start, end) with "@path " and returns the caret after it.
export function insertMention(text: string, start: number, end: number, path: string): { text: string; caret: number } {
  const inserted = `@${path} `
  const rest = text.slice(end).replace(/^\s/, "")
  return { text: text.slice(0, start) + inserted + rest, caret: start + inserted.length }
}

// Mentioned paths that are real files, in order, without duplicates.
// Trailing punctuation is tolerated ("see @a.ts," mentions a.ts).
export function extractMentions(text: string, known: ReadonlySet<string>): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/(?:^|\s)@(\S+)/g)) {
    const raw = match[1]
    const path = known.has(raw) ? raw : raw.replace(TRAILING_PUNCTUATION, "")
    if (known.has(path) && !found.includes(path)) found.push(path)
  }
  return found
}

// Removes every "@path" mention of `path` (and the space after it).
export function removeMention(text: string, path: string): string {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return text.replace(new RegExp(`(^|\\s)@${escaped}(?=\\s|$|[.,;:!?)\\]}'"\`])\\s?`, "g"), "$1")
}
