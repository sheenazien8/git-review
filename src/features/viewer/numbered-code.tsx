import type { ReactNode } from "react"
import { Check } from "lucide-react"
import { copyTitleFor, useCopyRange } from "@/features/clipboard/use-copy-range"
import { cn } from "@/lib/utils"

// Code block with a line-number gutter; clicking line numbers copies
// "<fullPath>:<line>" (or a range, see useCopyRange).
export function NumberedCode({ lineCount, fullPath, children }: {
  lineCount: number
  fullPath: string
  children: ReactNode
}) {
  const { copiedKey, anchor, click, rangePreview, setHover } = useCopyRange(fullPath)

  return (
    <div className="flex text-xs font-mono" onMouseLeave={() => setHover(null)}>
      <div className="shrink-0 select-none border-r border-border bg-muted/30 py-4 leading-5 text-muted-foreground">
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
