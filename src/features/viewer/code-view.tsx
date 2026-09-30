import { useMemo } from "react"
import { clipMatches, findMatches, highlightHtmlWithMatches, lineStartOffsets, splitLines } from "@/features/find/find"
import { ScrollToActiveMatch } from "@/features/find/highlight-segments"
import { highlightCode } from "./highlight-code"
import { NumberedCode } from "./numbered-code"
import type { FindProps } from "./types"

// Syntax-highlighted file content with find-match highlighting.
export function CodeView({ content, file, fullPath, findQuery, findCaseSensitive, findMatchIndex }: FindProps & {
  content: string
  file: string
  fullPath: string
}) {
  const findActive = !!(findQuery && findMatchIndex !== undefined)
  const highlightedHtml = useMemo(() => highlightCode(content, file), [content, file])
  const lines = useMemo(() => splitLines(content), [content])
  const htmlLines = useMemo(() => splitLines(highlightedHtml), [highlightedHtml])

  const lineHtml = useMemo(() => {
    if (!findActive) return htmlLines
    const matches = findMatches(content, findQuery ?? "", findCaseSensitive ?? false)
    const starts = lineStartOffsets(lines)
    return htmlLines.map((html, i) => {
      const start = starts[i]
      const lineMatches = clipMatches(matches, start, start + lines[i].length)
      const before = matches.filter(m => m.end <= start).length
      const activeGlobalIndex = findMatchIndex ?? 0
      return highlightHtmlWithMatches(html, lineMatches, activeGlobalIndex - before, activeGlobalIndex)
    })
  }, [content, htmlLines, lines, findActive, findQuery, findCaseSensitive, findMatchIndex])

  return (
    <>
      <NumberedCode lineCount={lines.length} fullPath={fullPath}>
        {findActive
          ? lineHtml.map((html, i) => (
              <span key={i} className="block h-5 whitespace-pre" dangerouslySetInnerHTML={{ __html: html }} />
            ))
          : <span dangerouslySetInnerHTML={{ __html: highlightedHtml }} />}
      </NumberedCode>
      {findActive && <ScrollToActiveMatch index={findMatchIndex} />}
    </>
  )
}
