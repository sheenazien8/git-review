import { useMemo } from "react"
import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"
import { findMatches, highlightChunks, splitLines } from "@/features/find/find"
import { HighlightSegments, ScrollToActiveMatch } from "@/features/find/highlight-segments"
import { NumberedCode } from "./numbered-code"
import type { FindProps } from "./types"

// Rendered Markdown. While find is active it falls back to plain numbered
// text, since matches can't be mapped into the rendered output.
export function MarkdownView({ content, fullPath, findQuery, findCaseSensitive, findMatchIndex }: FindProps & {
  content: string
  fullPath: string
}) {
  if (findQuery && findMatchIndex !== undefined) {
    return (
      <SearchableText
        content={content}
        fullPath={fullPath}
        query={findQuery}
        caseSensitive={findCaseSensitive ?? false}
        matchIndex={findMatchIndex}
      />
    )
  }

  return (
    <div className="p-4 prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </Markdown>
    </div>
  )
}

function SearchableText({ content, fullPath, query, caseSensitive, matchIndex }: {
  content: string
  fullPath: string
  query: string
  caseSensitive: boolean
  matchIndex: number
}) {
  const lines = useMemo(() => splitLines(content), [content])
  const lineSegments = useMemo(
    () => highlightChunks(lines, findMatches(content, query, caseSensitive), matchIndex),
    [content, lines, query, caseSensitive, matchIndex]
  )

  return (
    <>
      <NumberedCode lineCount={lines.length} fullPath={fullPath}>
        {lineSegments.map((segments, i) => (
          <span key={i} className="block h-5 whitespace-pre">
            <HighlightSegments segments={segments} />
          </span>
        ))}
      </NumberedCode>
      <ScrollToActiveMatch index={matchIndex} />
    </>
  )
}
