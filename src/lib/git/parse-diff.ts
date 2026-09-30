export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffLine {
  type: "add" | "remove" | "context"
  content: string
  oldLineNo?: number
  newLineNo?: number
}

export function parseDiff(raw: string): DiffHunk[] {
  const hunks: DiffHunk[] = []
  // Git diff output ends with a trailing newline; splitting on "\n" produces
  // an extra empty string that would be parsed as a bogus context line.
  const lines = raw.replace(/\n$/, "").split("\n")
  let currentHunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (currentHunk) hunks.push(currentHunk)
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      oldLine = m ? parseInt(m[1]) : 0
      newLine = m ? parseInt(m[2]) : 0
      currentHunk = { header: line, lines: [] }
    } else if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({ type: "add", content: line, newLineNo: newLine++ })
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({ type: "remove", content: line, oldLineNo: oldLine++ })
      } else if (!line.startsWith("\\")) {
        currentHunk.lines.push({ type: "context", content: line, oldLineNo: oldLine++, newLineNo: newLine++ })
      }
    }
  }

  if (currentHunk) hunks.push(currentHunk)
  return hunks
}
