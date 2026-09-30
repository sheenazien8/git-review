import { useMemo } from "react"
import { Check } from "lucide-react"
import { copyTitleFor, useCopyRange } from "@/features/clipboard/use-copy-range"
import { findMatches, highlightChunks, type HighlightSegment } from "@/features/find/find"
import { HighlightSegments, ScrollToActiveMatch } from "@/features/find/highlight-segments"
import { parseDiff } from "@/lib/git/parse-diff"
import { cn } from "@/lib/utils"
import type { FindProps } from "./types"

const addBg = "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
const removeBg = "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
const ctxText = "text-neutral-700 dark:text-neutral-300"
const hunkBg = "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"

export function DiffView({ raw, view, fullPath, findQuery, findCaseSensitive, findMatchIndex }: FindProps & {
  raw: string
  view: "unified" | "split"
  fullPath: string
}) {
  const hunks = useMemo(() => parseDiff(raw), [raw])
  const { copiedKey, anchor, click, rangePreview, setHover } = useCopyRange(fullPath)
  const findActive = !!(findQuery && findMatchIndex !== undefined)

  // Find runs over the diff as displayed: each hunk header followed by its
  // lines, joined with "\n". Segments are mapped back per header/line.
  const highlighted = useMemo(() => {
    if (!findActive) return null
    const texts = hunks.flatMap(hunk => [hunk.header, ...hunk.lines.map(line => line.content)])
    const segments = highlightChunks(texts, findMatches(texts.join("\n"), findQuery ?? "", findCaseSensitive ?? false), findMatchIndex ?? -1)
    let i = 0
    return hunks.map(hunk => ({
      header: segments[i++],
      lines: hunk.lines.map(() => segments[i++]) as HighlightSegment[][],
    }))
  }, [hunks, findActive, findQuery, findCaseSensitive, findMatchIndex])

  if (hunks.length === 0) {
    const rename = raw.match(/^rename from (.+)\nrename to (.+)$/m)
    if (rename) {
      return (
        <div className="p-4 text-sm">
          <div className="rounded border bg-muted/40 p-3 font-mono text-xs">
            <div className="text-muted-foreground">similarity index 100%</div>
            <div>rename from <span className="font-semibold">{rename[1]}</span></div>
            <div>rename to <span className="font-semibold">{rename[2]}</span></div>
          </div>
        </div>
      )
    }
    return <div className="p-4 text-center text-sm text-muted-foreground">No diff output</div>
  }

  // While a line is anchored, hovering another line previews the range that
  // the second click would copy.
  const inRange = (lineNo: number | undefined) =>
    rangePreview != null && lineNo != null && lineNo >= rangePreview[0] && lineNo <= rangePreview[1]

  return (
    <div className="font-mono text-xs" onMouseLeave={() => setHover(null)}>
      {hunks.map((hunk, hi) => (
        <table key={hi} className="min-w-full border-collapse">
          <thead>
            <tr>
              <td colSpan={view === "split" ? 2 : 3} className={cn(hunkBg, "px-2 py-1 sticky top-0 z-10")}>
                {highlighted ? <HighlightSegments segments={highlighted[hi].header} /> : hunk.header}
              </td>
            </tr>
          </thead>
          <tbody>
            {hunk.lines.map((line, li) => {
              const key = `${view === "split" ? "s" : "u"}-${hi}-${li}`
              const lineNo = line.type === "remove" ? line.oldLineNo : line.newLineNo
              const copied = copiedKey === key
              const isAnchor = anchor === lineNo
              const numCls = isAnchor
                ? "bg-primary! text-primary-foreground!"
                : inRange(lineNo)
                  ? "bg-primary/15!"
                  : ""
              const content = highlighted ? <HighlightSegments segments={highlighted[hi].lines[li]} /> : line.content
              const rowProps = {
                title: copyTitleFor(fullPath, anchor, lineNo ?? 0),
                onClick: () => click(lineNo, key),
                onMouseEnter: () => setHover(lineNo ?? null),
              }
              const check = <Check size={12} className="inline-block align-middle" />

              if (view === "split") {
                const shown = line.type === "add" ? undefined : line.oldLineNo
                const contentBg = line.type === "add" ? addBg : line.type === "remove" ? removeBg : ctxText
                return (
                  <tr key={li} {...rowProps} className="cursor-pointer">
                    <td className={cn("w-10 select-none border-r border-border bg-muted text-right text-xs text-muted-foreground pr-1", numCls)}>
                      {copied ? check : isAnchor ? lineNo : shown ?? ""}
                    </td>
                    <td className={cn("whitespace-pre pl-1", contentBg)}>{content}</td>
                  </tr>
                )
              }

              const bg = line.type === "add" ? addBg : line.type === "remove" ? removeBg : ctxText
              const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " "
              return (
                <tr key={li} {...rowProps} className={cn("cursor-pointer", bg)}>
                  <td className={cn("w-12 select-none border-r border-border text-right pr-2", numCls || "text-muted-foreground")}>
                    {copied ? check : lineNo ?? ""}
                  </td>
                  <td className="w-5 select-none text-center">{prefix}</td>
                  <td className="whitespace-pre pl-2">{content}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ))}
      {findActive && <ScrollToActiveMatch index={findMatchIndex} />}
    </div>
  )
}
