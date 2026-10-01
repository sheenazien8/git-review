import { useMemo } from "react"
import { clipMatches, findMatches, highlightHtmlWithMatches, lineStartOffsets, splitLines } from "@/features/find/find"
import { ScrollToActiveMatch } from "@/features/find/highlight-segments"
import { highlightCode } from "./highlight-code"
import { NumberedCode } from "./numbered-code"
import type { FindProps } from "./types"

// Syntax-highlighted content as a whole (`html`) and, while find is active,
// per line with the matches marked (`lineHtml`, null otherwise).
export function useHighlightedLines(content: string, file: string, { findQuery, findCaseSensitive, findMatchIndex }: FindProps) {
  const findActive = !!(findQuery && findMatchIndex !== undefined)
  const html = useMemo(() => highlightCode(content, file), [content, file])
  const lines = useMemo(() => splitLines(content), [content])

  const lineHtml = useMemo(() => {
    if (!findActive) return null
    const htmlLines = splitLines(html)
    const matches = findMatches(content, findQuery ?? "", findCaseSensitive ?? false)
    const starts = lineStartOffsets(lines)
    return htmlLines.map((h, i) => {
      const start = starts[i]
      const lineMatches = clipMatches(matches, start, start + (lines[i]?.length ?? 0))
      const before = matches.filter(m => m.end <= start).length
      const activeGlobalIndex = findMatchIndex ?? 0
      return highlightHtmlWithMatches(h, lineMatches, activeGlobalIndex - before, activeGlobalIndex)
    })
  }, [content, html, lines, findActive, findQuery, findCaseSensitive, findMatchIndex])

  return { html, lineCount: lines.length, lineHtml }
}

// The highlighted code for NumberedCode's body: one block, or one row per
// line while find marks are shown.
export function HighlightedBody({ html, lineHtml }: { html: string; lineHtml: string[] | null }) {
  return lineHtml
    ? lineHtml.map((h, i) => <span key={i} className="block h-5 whitespace-pre" dangerouslySetInnerHTML={{ __html: h }} />)
    : <span dangerouslySetInnerHTML={{ __html: html }} />
}

// Syntax-highlighted file content with find-match highlighting.
export function CodeView({ content, file, fullPath, gotoLine, ...find }: FindProps & {
  content: string
  file: string
  fullPath: string
  gotoLine?: { line: number }
}) {
  const { html, lineCount, lineHtml } = useHighlightedLines(content, file, find)

  return (
    <>
      <NumberedCode lineCount={lineCount} fullPath={fullPath} target={gotoLine}>
        <HighlightedBody html={html} lineHtml={lineHtml} />
      </NumberedCode>
      {lineHtml && <ScrollToActiveMatch index={find.findMatchIndex} />}
    </>
  )
}
