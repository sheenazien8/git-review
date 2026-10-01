import type { ReactNode } from "react"
import { GitCommitHorizontal, RefreshCw, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { basename } from "@/features/files/file-types"
import { statusIcon } from "@/features/files/status-display"
import type { GitFile } from "@/lib/git/types"
import { cn } from "@/lib/utils"
import type { BufferEntry } from "./buffer"

function Tip({ tip, children }: { tip: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  )
}

// Tab strip — one entry per open file. Click a tab to activate; ↻ to refresh
// its content; × to close (confirming when there are unsaved edits).
export function TabBar({ entries, activeId, files, onActivate, onRefresh, onClose }: {
  entries: BufferEntry[]
  activeId: string | null
  files: GitFile[]
  onActivate: (id: string) => void
  onRefresh: (entry: BufferEntry) => void
  onClose: (entry: BufferEntry) => void
}) {
  if (entries.length === 0) return null

  return (
    <div
      role="tablist"
      aria-label="Open files"
      className="diff-tabs mb-1 flex min-h-8 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border border-border bg-card px-1 py-1"
    >
      {entries.map(entry => {
        const isActive = entry.id === activeId
        const status = files.find(f => f.path === entry.file && f.staged === entry.staged)?.status
          ?? (entry.fromAll ? "untracked" : "modified")
        const subject = entry.commitData?.commit.subject
        const label = entry.commit ? subject || entry.commit.slice(0, 7) : basename(entry.file)
        const tip = entry.commit
          ? `Commit ${entry.commit.slice(0, 10)}${subject ? ` — ${subject}` : ""}`
          : `${entry.file}${entry.staged ? " (staged)" : ""}${entry.fromAll ? " (from All Files)" : ""}`
        return (
          <div
            key={entry.id}
            role="tab"
            aria-selected={isActive}
            data-tab-id={entry.id}
            className={cn(
              "group flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs outline-none transition-colors",
              isActive ? "border-primary/40 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Tip tip={<p className="text-xs">{tip}</p>}>
              <button type="button" onClick={() => onActivate(entry.id)} className="flex min-w-0 items-center gap-1.5 text-left">
                <span className="shrink-0">{entry.commit ? <GitCommitHorizontal size={14} /> : statusIcon(status)}</span>
                <span className="max-w-40 truncate">{label}</span>
                {entry.dirty && <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-label="Unsaved changes" />}
                {entry.diffLoading && <RefreshCw size={11} className="shrink-0 animate-spin text-muted-foreground" />}
              </button>
            </Tip>
            <Tip tip="Refresh">
              <button
                type="button"
                aria-label={`Refresh ${entry.commit ? label : entry.file}`}
                disabled={entry.diffLoading}
                onClick={e => { e.stopPropagation(); onRefresh(entry) }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <RefreshCw size={11} />
              </button>
            </Tip>
            <Tip tip="Close tab">
              <button
                type="button"
                aria-label={`Close ${entry.commit ? label : entry.file}`}
                onClick={e => { e.stopPropagation(); onClose(entry) }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              >
                <X size={11} />
              </button>
            </Tip>
          </div>
        )
      })}
    </div>
  )
}
