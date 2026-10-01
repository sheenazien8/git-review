// Conflict markers in a file left by a merge:
//
//   <<<<<<< HEAD          ours
//   ||||||| base          base (diff3 / zdiff3 conflict style only)
//   =======
//   >>>>>>> feature       theirs
//
// Segment texts keep their line terminators, so joining every segment's text
// back together reproduces the file byte for byte.

export interface TextSegment {
  type: "text"
  text: string
}

export interface ConflictSegment {
  type: "conflict"
  ours: string
  theirs: string
  // Only with the diff3 / zdiff3 conflict style.
  base?: string
  oursLabel: string
  theirsLabel: string
  baseLabel?: string
  // The whole block including marker lines, as it appears in the file.
  raw: string
}

export type Segment = TextSegment | ConflictSegment

export type ConflictChoice = "ours" | "theirs" | "both"

// A marker is 7 identical characters, optionally followed by a space and a label.
function marker(line: string, char: string): string | null {
  const body = line.replace(/\r?\n$/, "")
  const prefix = char.repeat(7)
  if (body === prefix) return ""
  if (body.startsWith(prefix + " ")) return body.slice(8)
  return null
}

// Lines with their terminators ("a\n", "b\r\n", "last-without-newline").
function splitKeepingNewlines(content: string): string[] {
  return content.match(/[^\n]*\n|[^\n]+$/g) ?? []
}

export function parseConflicts(content: string): Segment[] {
  const lines = splitKeepingNewlines(content)
  const segments: Segment[] = []
  let text = ""

  const flushText = () => {
    if (text) segments.push({ type: "text", text })
    text = ""
  }

  let i = 0
  while (i < lines.length) {
    const oursLabel = marker(lines[i], "<")
    if (oursLabel === null) {
      text += lines[i++]
      continue
    }
    // Scan for the rest of the block; an unterminated block is plain text.
    const block = { ours: "", base: undefined as string | undefined, baseLabel: undefined as string | undefined, theirs: "" }
    let part: "ours" | "base" | "theirs" = "ours"
    let end = -1
    let theirsLabel = ""
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]
      if (part === "ours" && marker(line, "|") !== null) {
        part = "base"
        block.base = ""
        block.baseLabel = marker(line, "|") ?? ""
      } else if (part !== "theirs" && marker(line, "=") === "") {
        part = "theirs"
      } else if (part === "theirs" && marker(line, ">") !== null) {
        theirsLabel = marker(line, ">") ?? ""
        end = j
        break
      } else if (part === "base") {
        block.base += line
      } else {
        block[part] += line
      }
    }
    if (end === -1) {
      text += lines[i++]
      continue
    }
    flushText()
    segments.push({
      type: "conflict",
      ours: block.ours,
      theirs: block.theirs,
      base: block.base,
      oursLabel,
      theirsLabel,
      baseLabel: block.baseLabel,
      raw: lines.slice(i, end + 1).join(""),
    })
    i = end + 1
  }
  flushText()
  return segments
}

export function countConflicts(segments: Segment[]): number {
  return segments.filter(s => s.type === "conflict").length
}

export function joinSegments(segments: Segment[]): string {
  return segments.map(s => (s.type === "text" ? s.text : s.raw)).join("")
}

function withTrailingNewline(text: string): string {
  return text && !text.endsWith("\n") ? text + "\n" : text
}

// The file content after resolving the `index`-th conflict block (0-based,
// counting conflicts only) with `choice`.
export function resolveConflict(content: string, index: number, choice: ConflictChoice): string {
  let n = -1
  return parseConflicts(content)
    .map(s => {
      if (s.type === "text") return s.text
      n++
      if (n !== index) return s.raw
      if (choice === "ours") return s.ours
      if (choice === "theirs") return s.theirs
      return withTrailingNewline(s.ours) + s.theirs
    })
    .join("")
}
