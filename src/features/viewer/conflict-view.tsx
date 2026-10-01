import { useMemo, useState } from "react"
import { Check, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { splitLines } from "@/features/find/find"
import { type ConflictChoice, type ConflictSegment, countConflicts, parseConflicts } from "@/lib/git/parse-conflict"
import { cn } from "@/lib/utils"

const oursCls = "bg-blue-50 text-blue-950 dark:bg-blue-950/60 dark:text-blue-100"
const theirsCls = "bg-purple-50 text-purple-950 dark:bg-purple-950/60 dark:text-purple-100"
const CONTEXT = 3

function Code({ text, className }: { text: string; className?: string }) {
  return <pre className={cn("overflow-x-auto whitespace-pre px-3 py-1 leading-5", className)}>{text || " "}</pre>
}

// Unchanged text between conflicts, trimmed to a few lines of context on the
// sides that touch a conflict (expandable).
function Context({ text, before, after }: { text: string; before: boolean; after: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const lines = splitLines(text.replace(/\n$/, ""))
  const head = before ? CONTEXT : 0
  const tail = after ? CONTEXT : 0
  if (expanded || lines.length <= head + tail + 1) return <Code text={lines.join("\n")} className="text-muted-foreground" />
  return (
    <>
      {head > 0 && <Code text={lines.slice(0, head).join("\n")} className="text-muted-foreground" />}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="block w-full bg-muted/50 px-3 py-0.5 text-left text-[11px] text-muted-foreground hover:bg-accent"
      >
        ⋯ {lines.length - head - tail} unchanged lines
      </button>
      {tail > 0 && <Code text={lines.slice(-tail).join("\n")} className="text-muted-foreground" />}
    </>
  )
}

function Side({ label, text, className }: { label: string; text: string; className: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="border-b border-border/50 px-3 py-1 font-sans text-[11px] font-medium opacity-80">{label}</div>
      <Code text={text.replace(/\n$/, "")} />
    </div>
  )
}

function ConflictBlock({ conflict, n, onResolve }: {
  conflict: ConflictSegment
  n: number
  onResolve: (choice: ConflictChoice) => void
}) {
  return (
    <div className="my-2 overflow-hidden rounded-md border border-orange-300 dark:border-orange-800">
      <div className="flex flex-wrap items-center gap-1 border-b border-orange-300 bg-orange-50 px-2 py-1 font-sans dark:border-orange-800 dark:bg-orange-950/40">
        <span className="mr-auto text-[11px] font-medium text-orange-800 dark:text-orange-300">Conflict {n}</span>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onResolve("ours")}>Accept current</Button>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onResolve("theirs")}>Accept incoming</Button>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onResolve("both")}>Accept both</Button>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Side label={`Current${conflict.oursLabel ? ` · ${conflict.oursLabel}` : ""}`} text={conflict.ours} className={oursCls} />
        <Side label={`Incoming${conflict.theirsLabel ? ` · ${conflict.theirsLabel}` : ""}`} text={conflict.theirs} className={theirsCls} />
      </div>
      {conflict.base !== undefined && (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-3 py-1 font-sans text-[11px] text-muted-foreground">
            Common ancestor{conflict.baseLabel ? ` · ${conflict.baseLabel}` : ""}
          </summary>
          <Code text={conflict.base.replace(/\n$/, "")} className="bg-muted/40" />
        </details>
      )}
    </div>
  )
}

// Merge-conflict resolution: each <<<<<<< / ======= / >>>>>>> block becomes a
// current-vs-incoming pane with accept buttons. Resolving rewrites the working
// content; saving and staging ("Mark resolved") happen from the toolbar.
export function ConflictView({ content, error, dirty, onResolve }: {
  content: string
  error: string
  // Resolutions not saved to disk yet.
  dirty: boolean
  onResolve: (index: number, choice: ConflictChoice) => void
}) {
  const segments = useMemo(() => parseConflicts(content), [content])
  const total = countConflicts(segments)
  // Segment index → conflict number (0-based), for conflict segments.
  const conflictIndex = useMemo(() => {
    let n = 0
    return segments.map(s => (s.type === "conflict" ? n++ : -1))
  }, [segments])

  if (error) return <div className="p-4 text-sm text-destructive whitespace-pre-wrap break-words">{error}</div>

  return (
    <div className="p-3 font-mono text-xs">
      <div
        className={cn(
          "mb-2 flex items-center gap-2 rounded-md border px-3 py-2 font-sans text-sm",
          total > 0
            ? "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200"
            : "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200"
        )}
      >
        {total > 0 ? <TriangleAlert size={14} /> : <Check size={14} />}
        {total > 0
          ? `${total} conflict${total > 1 ? "s" : ""} left in this file`
          : dirty
            ? "No conflict markers left — save, then mark the file as resolved."
            : "No conflict markers left — mark the file as resolved to stage it."}
      </div>
      {segments.map((s, i) => {
        if (s.type === "text") {
          return <Context key={i} text={s.text} before={i > 0} after={i < segments.length - 1} />
        }
        const index = conflictIndex[i]
        return <ConflictBlock key={i} conflict={s} n={index + 1} onResolve={choice => onResolve(index, choice)} />
      })}
    </div>
  )
}
