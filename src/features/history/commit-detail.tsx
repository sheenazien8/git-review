import { useEffect, useRef, useState } from "react"
import { AlignJustify, Check, ChevronDown, Copy, ExternalLink, RefreshCw, Split } from "lucide-react"
import { Button } from "@/components/ui/button"
import { statusBadgeColor, statusIcon, statusLabel } from "@/features/files/status-display"
import { DiffView } from "@/features/viewer/diff-view"
import type { CommitFile, CommitResponse } from "@/lib/git/types"
import { cn } from "@/lib/utils"
import { useCommitDiffs } from "./use-commit-diffs"

// Commits this small start with every file expanded.
const AUTO_EXPAND = 8

function CopySha({ sha }: { sha: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sha)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard unavailable (insecure context)
    }
  }
  return (
    <button type="button" onClick={copy} title="Copy full sha" className="inline-flex items-center gap-1 font-mono hover:text-foreground">
      {sha.slice(0, 10)}
      {copied ? <Check size={11} className="text-green-600 dark:text-green-400" /> : <Copy size={11} />}
    </button>
  )
}

function FileSection({ repo, file, expanded, diff, view, focused, onToggle, onOpenFile }: {
  repo: string
  file: CommitFile
  expanded: boolean
  diff: { diff: string; error: string } | undefined
  view: "unified" | "split"
  focused: boolean
  onToggle: () => void
  onOpenFile: (path: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "start" })
  }, [focused])

  return (
    <div ref={ref} className="border-b border-border">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggle()
          }
        }}
        className={cn(
          "group sticky top-0 z-20 flex cursor-pointer items-center gap-2 bg-card px-3 py-1.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
          focused && "bg-primary/10"
        )}
      >
        <ChevronDown size={14} className={cn("shrink-0 text-muted-foreground transition-transform", !expanded && "-rotate-90")} />
        <span className="shrink-0 text-muted-foreground">{statusIcon(file.status)}</span>
        <span className="min-w-0 flex-1 truncate font-mono" title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>
          {file.oldPath ? <><span className="text-muted-foreground">{file.oldPath} → </span>{file.path}</> : file.path}
        </span>
        <span className={cn("shrink-0 rounded border px-1.5 py-0 text-[10px]", statusBadgeColor(file.status))}>{statusLabel(file.status)}</span>
        {file.status !== "deleted" && (
          <button
            type="button"
            title="Open the current version of this file"
            onClick={e => {
              e.stopPropagation()
              onOpenFile(file.path)
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>
      {expanded && (
        diff === undefined ? (
          <div className="flex items-center justify-center py-4"><RefreshCw size={14} className="animate-spin text-muted-foreground" /></div>
        ) : diff.error ? (
          <div className="px-3 py-2 text-xs text-destructive">{diff.error}</div>
        ) : (
          <DiffView raw={diff.diff} view={view} fullPath={`${repo}/${file.path}`} />
        )
      )}
    </div>
  )
}

// A commit: message, author, parents, and the files it changed with their
// diffs (against the first parent), expandable one by one.
export function CommitDetail({ repo, data, focusFile, onOpenCommit, onOpenFile }: {
  repo: string
  data: CommitResponse
  // Expanded and scrolled to first (opened from this file's history).
  focusFile?: string
  onOpenCommit: (sha: string) => void
  onOpenFile: (path: string) => void
}) {
  const { commit, files } = data
  const { diffs, load } = useCommitDiffs(repo, commit.sha)
  const [view, setView] = useState<"unified" | "split">("unified")
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (focusFile && files.some(f => f.path === focusFile)) return new Set([focusFile])
    return new Set(files.length <= AUTO_EXPAND ? files.map(f => f.path) : [])
  })

  useEffect(() => {
    for (const file of files) if (expanded.has(file.path)) void load(file)
  }, [files, expanded, load])

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const date = commit.date ? new Date(commit.date).toLocaleString() : ""

  return (
    <div>
      <div className="space-y-2 border-b border-border p-4">
        <h2 className="text-base font-semibold break-words">{commit.subject}</h2>
        {commit.body && <pre className="whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">{commit.body}</pre>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span title={commit.email}><span className="font-medium text-foreground">{commit.author}</span> &lt;{commit.email}&gt;</span>
          <span>{date}</span>
          <CopySha sha={commit.sha} />
          {commit.parents.length > 0 && (
            <span className="flex items-center gap-1">
              {commit.parents.length > 1 ? "parents" : "parent"}
              {commit.parents.map(p => (
                <button key={p} type="button" onClick={() => onOpenCommit(p)} className="font-mono text-primary hover:underline">
                  {p.slice(0, 7)}
                </button>
              ))}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span className="flex-1">
          {files.length} file{files.length === 1 ? "" : "s"} changed
          {commit.parents.length > 1 && " (vs. first parent)"}
        </span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setExpanded(new Set(files.map(f => f.path)))}>
          Expand all
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setExpanded(new Set())}>
          Collapse all
        </Button>
        <Button variant={view === "unified" ? "default" : "outline"} size="icon" className="h-6 w-6" title="Unified diff" onClick={() => setView("unified")}>
          <AlignJustify size={12} />
        </Button>
        <Button variant={view === "split" ? "default" : "outline"} size="icon" className="h-6 w-6" title="Split diff" onClick={() => setView("split")}>
          <Split size={12} />
        </Button>
      </div>
      {files.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No file changes</div>}
      {files.map(file => (
        <FileSection
          key={file.path}
          repo={repo}
          file={file}
          expanded={expanded.has(file.path)}
          diff={diffs[file.path]}
          view={view}
          focused={file.path === focusFile}
          onToggle={() => toggle(file.path)}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  )
}
