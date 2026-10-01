import { type BlameCommit, type BlameResponse, UNCOMMITTED_SHA } from "./types"

const HEADER = /^([0-9a-f]{40}|[0-9a-f]{64}) (\d+) (\d+)(?: \d+)?$/

function isoFromEpoch(seconds: string): string {
  const n = Number(seconds)
  return Number.isFinite(n) ? new Date(n * 1000).toISOString() : ""
}

// The blamed file's text, as the blame view shows it.
export function blameContent({ lines }: BlameResponse): string {
  return lines.map(l => l.content).join("\n")
}

// Parses `git blame --porcelain`. Each line starts with
// "<sha> <orig-line> <final-line> [<group-size>]"; the first time a sha shows
// up it is followed by "key value" header lines (author, author-time, summary,
// …), and every entry ends with the line content prefixed by a tab.
export function parseBlame(output: string): BlameResponse {
  const lines: BlameResponse["lines"] = []
  const commits: Record<string, BlameCommit> = {}
  let current: { sha: string; line: number } | null = null

  for (const raw of output.split("\n")) {
    if (current && raw.startsWith("\t")) {
      lines.push({ line: current.line, sha: current.sha, content: raw.slice(1) })
      current = null
      continue
    }
    const header = HEADER.exec(raw)
    if (header) {
      const sha = header[1]
      current = { sha, line: Number(header[3]) }
      commits[sha] ??= {
        sha,
        author: "",
        email: "",
        date: "",
        summary: "",
        uncommitted: sha === UNCOMMITTED_SHA,
      }
      continue
    }
    if (!current) continue
    const commit = commits[current.sha]
    const space = raw.indexOf(" ")
    const key = space === -1 ? raw : raw.slice(0, space)
    const value = space === -1 ? "" : raw.slice(space + 1)
    switch (key) {
      case "author": commit.author = value; break
      case "author-mail": commit.email = value.replace(/^<|>$/g, ""); break
      case "author-time": commit.date = isoFromEpoch(value); break
      case "summary": commit.summary = value; break
    }
  }

  return { lines, commits }
}
