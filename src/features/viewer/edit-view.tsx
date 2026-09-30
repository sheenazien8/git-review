import { useCallback, useEffect, useMemo, useRef } from "react"
import { findMatches } from "@/features/find/find"
import { highlightCode } from "./highlight-code"
import type { FindProps } from "./types"

// Plain textarea layered over a syntax-highlighted <pre>, scrolled in sync.
export function EditView({ content, file, onChange, findQuery, findCaseSensitive, findMatchIndex, onMatchIndexClamp }: FindProps & {
  content: string
  file: string
  onChange: (v: string) => void
  onMatchIndexClamp?: (clamped: number) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const highlightedHtml = useMemo(() => highlightCode(content, file), [content, file])
  const lines = useMemo(() => content.split("\n"), [content])

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current
    if (!ta || !preRef.current || !gutterRef.current) return
    preRef.current.scrollTop = ta.scrollTop
    preRef.current.scrollLeft = ta.scrollLeft
    gutterRef.current.scrollTop = ta.scrollTop
  }, [])

  useEffect(() => {
    if (!findQuery || findMatchIndex === undefined) return
    const ta = textareaRef.current
    if (!ta) return
    const matches = findMatches(content, findQuery, findCaseSensitive ?? false)
    if (matches.length === 0) return
    let idx = findMatchIndex % matches.length
    if (idx < 0) idx += matches.length
    if (idx !== findMatchIndex) {
      onMatchIndexClamp?.(idx)
    }
    const match = matches[idx]
    // Setting the selection range only takes effect reliably while the
    // textarea is focused, but this effect re-runs on every keystroke typed
    // into the find input (findQuery changes) — stealing focus here would
    // redirect the next keystroke into the file content instead of the find
    // box. Focus the textarea just long enough to apply the selection, then
    // immediately hand focus back to whatever had it (the find input or a
    // find-bar button).
    const previousActive = document.activeElement
    ta.focus()
    ta.setSelectionRange(match.start, match.end)
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20
    const line = content.slice(0, match.start).split("\n").length
    ta.scrollTop = Math.max(0, (line - 1) * lineHeight - ta.clientHeight / 2)
    if (previousActive instanceof HTMLElement && previousActive !== ta) {
      previousActive.focus()
    }
  }, [content, findQuery, findCaseSensitive, findMatchIndex, onMatchIndexClamp])

  return (
    <div className="flex h-full text-xs font-mono">
      <div
        ref={gutterRef}
        className="shrink-0 select-none overflow-hidden border-r border-border bg-muted/30 py-4 pr-2 pl-3 text-right text-muted-foreground leading-5"
      >
        {lines.map((_, i) => (
          <div key={i} className="h-5">{i + 1}</div>
        ))}
      </div>
      <div className="relative flex-1">
        <pre
          ref={preRef}
          className="absolute inset-0 m-0 overflow-hidden p-4 leading-5"
          style={{ whiteSpace: "pre", overflowWrap: "normal", wordWrap: "normal", tabSize: 2 }}
        >
          <code className="hljs p-0! bg-transparent!" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          {/* Pad with extra newlines so the pre element always has a bit more
              scrollable height than the textarea, keeping cursor alignment
              accurate at the end of the file. */}
          <span dangerouslySetInnerHTML={{ __html: "\n\n\n\n\n\n\n\n\n\n" }} />
        </pre>
        <textarea
          ref={textareaRef}
          className="absolute inset-0 h-full w-full resize-none bg-transparent p-4 leading-5 text-transparent outline-none"
          style={{ whiteSpace: "pre", overflowWrap: "normal", wordWrap: "normal", tabSize: 2, caretColor: "var(--foreground)" }}
          value={content}
          onChange={e => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
        />
      </div>
    </div>
  )
}
