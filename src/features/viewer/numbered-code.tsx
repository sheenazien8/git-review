import { useEffect, useRef, type ReactNode } from "react"
import { Check } from "lucide-react"
import { copyTitleFor, useCopyRange } from "@/features/clipboard/use-copy-range"
import { cn } from "@/lib/utils"

// Code block with a line-number gutter; clicking line numbers copies
// "<fullPath>:<line>" (or a range, see useCopyRange). `target` scrolls to
// and highlights a line (Quick Open "path:line").
export function NumberedCode({ lineCount, fullPath, target, children }: {
  lineCount: number
  fullPath: string
  target?: { line: number }
  children: ReactNode
}) {
  const { copiedKey, anchor, click, rangePreview, setHover } = useCopyRange(fullPath)
  const gutterRef = useRef<HTMLDivElement>(null)
  const targetLine = target && target.line <= lineCount ? target.line : undefined

  // Runs again when content (re)loads so the jump survives the async fetch.
  useEffect(() => {
    if (!target || target.line > lineCount) return
    gutterRef.current?.children[target.line - 1]?.scrollIntoView({ block: "center" })
  }, [target, lineCount])

  return (
    <div className="relative flex text-xs font-mono" onMouseLeave={() => setHover(null)}>
      {targetLine !== undefined && (
        // py-4 (16px) + 20px rows, matching the gutter.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-5 bg-primary/10"
          style={{ top: 16 + (targetLine - 1) * 20 }}
        />
      )}
      <div ref={gutterRef} className="shrink-0 select-none border-r border-border bg-muted/30 py-4 leading-5 text-muted-foreground">
        {Array.from({ length: lineCount }, (_, i) => {
          const n = i + 1
          const key = `r-${n}`
          const copied = copiedKey === key
          const isAnchor = anchor === n
          const inPreview = rangePreview != null && n >= rangePreview[0] && n <= rangePreview[1]
          return (
            <div
              key={n}
              title={copyTitleFor(fullPath, anchor, n)}
              onClick={() => click(n, key)}
              onMouseEnter={() => setHover(n)}
              className={cn(
                "h-5 min-w-10 pl-3 pr-2 text-right cursor-pointer",
                copied && "text-green-600 dark:text-green-400",
                n === targetLine && "font-semibold text-foreground",
                isAnchor ? "bg-primary! text-primary-foreground!" : inPreview ? "bg-primary/15!" : "hover:bg-accent"
              )}
            >
              {copied ? <Check size={12} className="inline-block align-middle" /> : n}
            </div>
          )
        })}
      </div>
      <pre className="flex-1 overflow-x-auto p-4 leading-5">
        <code className="hljs p-0!">{children}</code>
      </pre>
    </div>
  )
}
