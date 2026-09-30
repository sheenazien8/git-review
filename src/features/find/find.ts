// In-file find: plain-text match search plus helpers to render matches both
// as React segments and inside highlight.js HTML.

export interface TextMatch {
  start: number
  end: number
}

export interface HighlightSegment {
  kind: "text" | "mark"
  text: string
  active: boolean
  globalIndex?: number
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function findMatches(text: string, query: string, caseSensitive: boolean): TextMatch[] {
  if (!query) return []
  const flags = caseSensitive ? "g" : "gi"
  const re = new RegExp(escapeRegExp(query), flags)
  const matches: TextMatch[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length })
    if (m[0].length === 0) re.lastIndex++
  }
  return matches
}

// Splits file content into lines, dropping the empty line after a trailing newline.
export function splitLines(content: string): string[] {
  const split = content.split("\n")
  if (split.length > 1 && split[split.length - 1] === "") split.pop()
  return split
}

// Offset of each line within the text the lines were split from ("\n"-joined).
export function lineStartOffsets(lines: string[]): number[] {
  const starts: number[] = []
  let offset = 0
  for (const line of lines) {
    starts.push(offset)
    offset += line.length + 1
  }
  return starts
}

// The parts of `matches` that overlap [start, end), rebased to `start`.
export function clipMatches(matches: TextMatch[], start: number, end: number): TextMatch[] {
  return matches
    .filter(m => m.start < end && m.end > start)
    .map(m => ({
      start: Math.max(m.start, start) - start,
      end: Math.min(m.end, end) - start,
    }))
}

export function highlightTextSegments(
  text: string,
  matches: TextMatch[],
  activeIndex: number,
  startAt: number
): { segments: HighlightSegment[]; count: number } {
  const segments: HighlightSegment[] = []
  let last = 0
  let count = 0
  for (const match of matches) {
    if (match.start > last) {
      segments.push({ kind: "text", text: text.slice(last, match.start), active: false })
    }
    const globalIndex = startAt + count
    segments.push({
      kind: "mark",
      text: text.slice(match.start, match.end),
      active: globalIndex === activeIndex,
      globalIndex,
    })
    count++
    last = match.end
  }
  if (last < text.length) {
    segments.push({ kind: "text", text: text.slice(last), active: false })
  }
  return { segments, count }
}

// Highlights matches across a list of text chunks (lines) that were joined
// with "\n" to form the searched text. Match indices are global across chunks.
export function highlightChunks(texts: string[], matches: TextMatch[], activeIndex: number): HighlightSegment[][] {
  const starts = lineStartOffsets(texts)
  let seen = 0
  return texts.map((text, i) => {
    const res = highlightTextSegments(text, clipMatches(matches, starts[i], starts[i] + text.length), activeIndex, seen)
    seen += res.count
    return res.segments
  })
}

// hljs's core escapeHTML() (node_modules/highlight.js/lib/core.js) escapes
// &, <, >, ", and ' — the last two as multi-character entities (&quot;,
// &#x27;). TextMatch offsets come from the *raw* file content, so 1 raw
// character can correspond to a multi-character entity in the highlighted
// HTML. Naively walking the HTML string char-by-char (as if 1 HTML char ==
// 1 text char) drifts the position mapping the moment a quote/apostrophe/&
// appears, corrupting the marks it inserts — e.g. splitting "&quot;" so the
// page renders the literal text "quot;" instead of a quote character.
const HTML_ENTITIES = ["&amp;", "&quot;", "&#x27;", "&lt;", "&gt;"]

// Maps a run of escaped HTML text back to raw-text positions without
// decoding it — `boundaries[i]` is the raw HTML index where decoded
// character `i` starts, so `value.slice(boundaries[a], boundaries[b])`
// yields the (still-escaped) HTML for decoded characters [a, b).
function htmlTextRunBoundaries(value: string): { boundaries: number[]; decodedLength: number } {
  const boundaries: number[] = [0]
  let i = 0
  while (i < value.length) {
    const entity = HTML_ENTITIES.find(e => value.startsWith(e, i))
    i += entity ? entity.length : 1
    boundaries.push(i)
  }
  return { boundaries, decodedLength: boundaries.length - 1 }
}

export function highlightHtmlWithMatches(
  html: string,
  matches: TextMatch[],
  activeIndex: number,
  activeGlobalIndex: number
): string {
  if (matches.length === 0) return html

  type Token =
    | { type: "text"; value: string }
    | { type: "tag"; value: string }

  const tokens: Token[] = []
  let i = 0
  while (i < html.length) {
    if (html[i] === "<") {
      const close = html.indexOf(">", i)
      if (close === -1) {
        tokens.push({ type: "text", value: html.slice(i) })
        break
      }
      tokens.push({ type: "tag", value: html.slice(i, close + 1) })
      i = close + 1
    } else {
      const nextTag = html.indexOf("<", i)
      const end = nextTag === -1 ? html.length : nextTag
      tokens.push({ type: "text", value: html.slice(i, end) })
      i = end
    }
  }

  let output = ""
  let pos = 0
  let activeMatch: number | null = null

  const openMark = (idx: number) => {
    if (idx === activeIndex) {
      output += `<mark class="bg-primary text-primary-foreground ring-1 ring-ring rounded-sm" data-find-match="${activeGlobalIndex}">`
    } else {
      output += '<mark class="bg-primary/25 text-foreground rounded-sm">'
    }
    activeMatch = idx
  }

  const closeMark = () => {
    if (activeMatch !== null) {
      output += "</mark>"
      activeMatch = null
    }
  }

  const startsAt = (textPos: number) => matches.findIndex(m => m.start === textPos)
  const endsAt = (textPos: number) => matches.findIndex(m => m.end === textPos)

  for (const token of tokens) {
    if (token.type === "tag") {
      const wasActive = activeMatch
      if (wasActive !== null) {
        const endIdx = endsAt(pos)
        if (endIdx !== -1 && matches[endIdx].end === pos) {
          closeMark()
          output += token.value
          continue
        }
        closeMark()
        output += token.value
        openMark(wasActive)
      } else {
        output += token.value
      }
      continue
    }

    // Decoded (raw-text) space, not HTML string space — this is what lines
    // up with `matches`, which were computed against the plain file content.
    const value = token.value
    const { boundaries, decodedLength } = htmlTextRunBoundaries(value)
    const startText = pos
    let offset = 0
    while (offset < decodedLength) {
      const curText = startText + offset
      const endIdx = endsAt(curText)
      if (endIdx !== -1 && activeMatch === endIdx) {
        closeMark()
      }
      const startIdx = startsAt(curText)
      if (startIdx !== -1) {
        openMark(startIdx)
      }
      const nextBoundary = Math.min(
        decodedLength,
        ...matches
          .filter(m => m.start > curText || m.end > curText)
          .map(m => (m.start > curText ? m.start : m.end) - startText)
      )
      // Slice the *original* escaped HTML at entity-safe boundaries — it is
      // already valid HTML, so it must not be re-escaped (that would double
      // -escape entities like &quot; into &amp;quot;).
      output += value.slice(boundaries[offset], boundaries[nextBoundary])
      offset = nextBoundary
    }
    pos = startText + decodedLength
  }
  closeMark()
  return output
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
