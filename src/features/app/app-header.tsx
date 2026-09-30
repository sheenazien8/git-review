import { useState, type ReactNode } from "react"
import { Bot, Check, FilePlus, Folder, FolderGit2, FolderMinus, FolderPlus, GitBranch, Menu, Moon, PanelLeft, RefreshCw, RotateCcw, Sun, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ActionResult } from "@/features/changes/use-git-actions"
import { projects } from "@/features/projects/projects"
import { findWorktree, worktreeLabel } from "@/features/worktrees/worktrees"
import type { ActionName, Worktree } from "@/lib/git/types"
import { cn } from "@/lib/utils"

function IconTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{tip}</TooltipContent>
    </Tooltip>
  )
}

const inputCls = "rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"

// Title bar (sidebar toggles, branch, last action result, theme, new file,
// discard all) plus the project + worktree selectors / refresh / commit / push row.
export function AppHeader(props: {
  branch: string
  error: string
  loading: boolean
  actionResult: ActionResult | null
  busyAction: ActionName | null
  isDark: boolean
  projectDir: string
  repoPath: string
  worktrees: Worktree[]
  onToggleTheme: () => void
  onToggleSidebar: () => void
  agentOpen: boolean
  onToggleAgent: () => void
  onOpenMobileSidebar: () => void
  onNewFile: () => void
  onDiscardAll: () => void
  onProjectChange: (project: string) => void
  onWorktreeChange: (repo: string) => void
  onAddWorktree: () => void
  onRemoveWorktree: (worktree: Worktree) => void
  onRefresh: () => void
  onCommit: (message: string) => Promise<boolean>
  onPush: () => void
}) {
  const { branch, error, loading, actionResult, busyAction, isDark, worktrees } = props
  const activeWorktree = findWorktree(worktrees, props.repoPath)
  const [commitMsg, setCommitMsg] = useState("")

  const commit = async () => {
    if (await props.onCommit(commitMsg)) setCommitMsg("")
  }

  return (
    <header className="shrink-0 border-b border-border">
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" title="Open file sidebar" onClick={props.onOpenMobileSidebar}>
          <Menu size={16} />
        </Button>
        <Button variant="ghost" size="icon" className="hidden h-8 w-8 md:inline-flex" title="Toggle sidebar (Ctrl+B)" onClick={props.onToggleSidebar}>
          <PanelLeft size={16} />
        </Button>
        <GitBranch size={18} className="text-muted-foreground" />
        <h1 className="text-sm font-semibold sm:text-lg">Git Review</h1>
        {branch && <Badge variant="secondary" className="text-xs">{branch}</Badge>}
        <div className="flex-1" />
        {actionResult && (
          <span
            className={cn("max-w-32 truncate text-xs sm:max-w-72", actionResult.ok ? "text-green-600 dark:text-green-400" : "text-destructive")}
            title={actionResult.message}
          >
            {actionResult.message}
          </span>
        )}
        <IconTip tip="Agent (Ctrl+I)">
          <Button
            variant={props.agentOpen ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            aria-pressed={props.agentOpen}
            onClick={props.onToggleAgent}
          >
            <Bot size={16} />
          </Button>
        </IconTip>
        <Button variant="outline" size="sm" onClick={props.onToggleTheme} className="gap-2">
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
        </Button>
        <IconTip tip="New File">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={props.onNewFile}>
            <FilePlus size={16} />
          </Button>
        </IconTip>
        <IconTip tip="Discard all changes">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 text-destructive hover:text-destructive"
            disabled={!!busyAction}
            onClick={props.onDiscardAll}
          >
            <RotateCcw size={16} />
          </Button>
        </IconTip>
      </div>

      <form
        onSubmit={e => { e.preventDefault(); props.onRefresh() }}
        className="grid grid-cols-4 gap-2 border-t border-border px-3 py-2 sm:flex sm:flex-wrap sm:items-center sm:px-4"
      >
        <div className="relative col-span-3 min-w-40 flex-1 sm:max-w-xs">
          <Folder size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <select
            value={props.projectDir}
            onChange={e => props.onProjectChange(e.target.value)}
            title={props.projectDir}
            className={cn(inputCls, "h-9 w-full cursor-pointer pl-9 pr-3 font-mono")}
          >
            {projects.map(p => (
              <option key={p.dir} value={p.dir}>{p.name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={loading} className="col-span-1 gap-1.5">
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        {worktrees.length > 0 && (
          <div className="col-span-4 flex gap-2 sm:min-w-64 sm:max-w-xs sm:flex-1">
            <div className="relative min-w-0 flex-1">
              <FolderGit2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select
                value={activeWorktree?.path ?? props.repoPath}
                onChange={e => props.onWorktreeChange(e.target.value)}
                title={`Worktree: ${props.repoPath}`}
                className={cn(inputCls, "h-9 w-full cursor-pointer pl-9 pr-3 font-mono")}
              >
                {!activeWorktree && <option value={props.repoPath}>{props.repoPath}</option>}
                {worktrees.map(w => (
                  <option key={w.path} value={w.path} disabled={w.prunable || w.bare}>{worktreeLabel(w)}</option>
                ))}
              </select>
            </div>
            <IconTip tip="Add worktree">
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={!!busyAction} onClick={props.onAddWorktree}>
                <FolderPlus size={16} />
              </Button>
            </IconTip>
            <IconTip tip="Remove this worktree">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                disabled={!!busyAction || !activeWorktree || activeWorktree.main}
                onClick={() => activeWorktree && props.onRemoveWorktree(activeWorktree)}
              >
                <FolderMinus size={16} />
              </Button>
            </IconTip>
          </div>
        )}
        <input
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && commitMsg.trim() && !busyAction) commit()
          }}
          placeholder="Commit message…"
          className={cn(inputCls, "col-span-2 h-9 min-w-40 flex-1 px-3 placeholder:text-muted-foreground")}
        />
        <Button size="sm" className="col-span-1 gap-1.5" disabled={!!busyAction || !commitMsg.trim()} onClick={commit}>
          {busyAction === "commit" ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
          Commit
        </Button>
        <Button variant="outline" size="sm" className="col-span-1 gap-1.5" disabled={!!busyAction} onClick={props.onPush}>
          {busyAction === "push" ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
          Push
        </Button>
      </form>

      {error && (
        <div className="border-t border-border bg-destructive/10 px-3 py-1.5 text-sm text-destructive sm:px-4" title={error}>
          <span className="line-clamp-1">{error}</span>
        </div>
      )}
    </header>
  )
}
