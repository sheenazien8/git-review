import { useMemo } from "react"
import { ScrollToActiveMatch } from "@/features/find/highlight-segments"
import { blameContent } from "@/lib/git/parse-blame"
import type { BlameCommit, BlameResponse } from "@/lib/git/types"
import { timeAgo } from "@/lib/time-ago"
import { cn } from "@/lib/utils"
import { HighlightedBody, useHighlightedLines } from "./code-view"
import { NumberedCode } from "./numbered-code"
import type { FindProps } from "./types"

function commitTitle(c: BlameCommit) {
  if (c.uncommitted) return "Not committed yet"
  const date = c.date ? new Date(c.date).toLocaleString() : ""
  return `${c.sha.slice(0, 10)} · ${c.author} <${c.email}>\n${date}\n\n${c.summary}`
}

// One gutter row: the first line of a run of lines from the same commit shows
// the sha + age, the second the author; the rest stay blank.
function GutterRow({ commit, offset, first, onOpenCommit }: {
  commit: BlameCommit
  offset: number
  first: boolean
  onOpenCommit: (sha: string) => void
}) {
  let body = null
  if (offset === 0) {
    body = commit.uncommitted ? (
      <span className="italic">Not committed</span>
    ) : (
      <>
        <button
          type="button"
          onClick={() => onOpenCommit(commit.sha)}
          className="font-mono text-primary hover:underline"
        >
          {commit.sha.slice(0, 7)}
        </button>
        <span className="ml-auto shrink-0">{timeAgo(commit.date)}</span>
      </>
    )
  } else if (offset === 1) {
    body = <span className="truncate">{commit.author}</span>
  }
  return (
    <div
      title={commitTitle(commit)}
      className={cn("flex h-5 items-center gap-2 overflow-hidden px-2", first && "border-t border-border")}
    >
      {body}
    </div>
  )
}

// File content with a blame gutter (commit, age, author per run of lines).
export function BlameView({ blame, file, fullPath, onOpenCommit, ...find }: FindProps & {
  blame: BlameResponse
  file: string
  fullPath: string
  onOpenCommit: (sha: string) => void
}) {
  const content = useMemo(() => blameContent(blame), [blame])
  const { html, lineCount, lineHtml } = useHighlightedLines(content, file, find)
  // Each line's position within its run of same-commit lines.
  const offsets = useMemo(() => {
    const result: number[] = []
    blame.lines.forEach((line, i) => {
      result.push(i > 0 && line.sha === blame.lines[i - 1].sha ? result[i - 1] + 1 : 0)
    })
    return result
  }, [blame])

  if (blame.lines.length === 0) return <div className="p-4 text-center text-sm text-muted-foreground">Empty file</div>

  return (
    <>
      <div className="flex text-xs font-mono">
        <div className="w-52 shrink-0 select-none border-r border-border bg-muted/30 py-4 font-sans leading-5 text-muted-foreground">
          {blame.lines.map((line, i) => (
            <GutterRow
              key={i}
              commit={blame.commits[line.sha]}
              offset={offsets[i]}
              first={i > 0 && offsets[i] === 0}
              onOpenCommit={onOpenCommit}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <NumberedCode lineCount={lineCount} fullPath={fullPath}>
            <HighlightedBody html={html} lineHtml={lineHtml} />
          </NumberedCode>
        </div>
      </div>
      {lineHtml && <ScrollToActiveMatch index={find.findMatchIndex} />}
    </>
  )
}
