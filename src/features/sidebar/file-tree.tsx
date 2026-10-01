import type { KeyboardEvent, ReactNode } from "react"
import { ChevronDown, File, Folder, Minus, Plus, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { statusBadgeColor, statusIcon, statusLabel } from "@/features/files/status-display"
import { cn } from "@/lib/utils"
import { collectFilePaths, type TreeNode } from "./tree"

// "all" = the All Files tree; "changes"/"staged" = one side of git status.
export type TreeMode = "all" | "changes" | "staged"

export interface FileTreeProps {
  nodes: TreeNode[]
  mode: TreeMode
  activeFile: string | undefined
  expanded: Set<string>
  // Show every dir expanded (while searching).
  expandAll: boolean
  busy: boolean
  onToggleDir: (path: string) => void
  onOpenFile: (path: string) => void
  onStage: (files: string[], staged: boolean) => void
  onDiscard: (files: string[], staged: boolean) => void
  onDelete: (path: string) => void
  // Right-click on a file: show its commit history.
  onShowHistory: (path: string) => void
}

function RowButton({ title, className, disabled, onClick, children }: {
  title: string
  className?: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-5 w-5 shrink-0", className)}
      disabled={disabled}
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
    >
      {children}
    </Button>
  )
}

const hoverReveal = "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"

// Keyboard navigation between rows: Enter/Space activates, Up/Down moves
// focus, Right/Left expands/collapses directories.
function handleRowKeyDown(
  e: KeyboardEvent<HTMLDivElement>,
  activate: () => void,
  dir: { expanded: boolean; toggle: () => void } | null
) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    activate()
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault()
    const container = e.currentTarget.closest("[data-sidebar-body]")
    const rows = container ? Array.from(container.querySelectorAll<HTMLElement>("[data-file-row]")) : []
    const i = rows.indexOf(e.currentTarget)
    rows[i + (e.key === "ArrowDown" ? 1 : -1)]?.focus()
  } else if (dir && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    if ((e.key === "ArrowRight") !== dir.expanded) {
      e.preventDefault()
      dir.toggle()
    }
  }
}

export function FileTree(props: FileTreeProps) {
  return <TreeLevel {...props} depth={0} />
}

function TreeLevel(props: FileTreeProps & { depth: number }) {
  const { nodes, mode, activeFile, expanded, expandAll, busy, depth } = props
  const staged = mode === "staged"

  return (
    <>
      {nodes.map(node => {
        const isDir = node.type === "dir"
        const isExpanded = isDir && (expandAll || expanded.has(node.path))
        const isActive = !isDir && activeFile === node.path
        const activate = () => (isDir ? props.onToggleDir(node.path) : props.onOpenFile(node.path))
        const dirKeys = isDir ? { expanded: isExpanded, toggle: () => props.onToggleDir(node.path) } : null

        let icon = statusIcon(node.status)
        if (isDir) icon = <Folder size={14} />
        else if (mode === "all") icon = node.status === "untracked" ? <Plus size={14} /> : <File size={14} />

        // All Files only badges untracked files; the git trees badge every
        // file except untracked ones (the icon already says so).
        const showBadge = !isDir && (mode === "all" ? node.status === "untracked" : node.status !== "untracked")

        return (
          <div key={node.path}>
            <div
              data-file-row
              tabIndex={0}
              role="button"
              onClick={activate}
              onKeyDown={e => handleRowKeyDown(e, activate, dirKeys)}
              onContextMenu={isDir ? undefined : e => {
                e.preventDefault()
                props.onShowHistory(node.path)
              }}
              style={{ paddingLeft: 8 + depth * 12 }}
              className={cn(
                "group flex items-center gap-1 rounded-md py-1.5 pr-1 text-xs outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    {isDir ? (
                      <ChevronDown
                        size={14}
                        className={cn("shrink-0 text-muted-foreground transition-transform", !isExpanded && "-rotate-90")}
                      />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span className={cn("shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")}>{icon}</span>
                    <span className={cn("flex-1 truncate", isDir && "font-medium")}>{node.name}</span>
                    {showBadge && (
                      <span
                        className={cn(
                          "shrink-0 rounded border px-1.5 py-0 text-[10px]",
                          isActive ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30" : statusBadgeColor(node.status)
                        )}
                      >
                        {statusLabel(node.status)}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">{node.path}</p>
                </TooltipContent>
              </Tooltip>
              {mode === "all" && !isDir && (
                <RowButton title="Delete file" className={hoverReveal} disabled={busy} onClick={() => props.onDelete(node.path)}>
                  <Trash2 size={12} />
                </RowButton>
              )}
              {mode !== "all" && isDir && (
                <RowButton
                  title={staged ? "Unstage all files in this directory" : "Stage all files in this directory"}
                  className="opacity-100"
                  disabled={busy}
                  onClick={() => props.onStage(collectFilePaths(node), staged)}
                >
                  {staged ? <Minus size={12} /> : <Plus size={12} />}
                </RowButton>
              )}
              {mode !== "all" && (
                <RowButton
                  title={isDir
                    ? staged ? "Discard staged changes in this directory" : "Discard changes in this directory"
                    : staged ? "Discard staged changes" : "Discard changes"}
                  className={hoverReveal}
                  disabled={busy}
                  onClick={() => props.onDiscard(collectFilePaths(node), staged)}
                >
                  <RotateCcw size={12} />
                </RowButton>
              )}
            </div>
            {isExpanded && <TreeLevel {...props} nodes={node.children} depth={depth + 1} />}
          </div>
        )
      })}
    </>
  )
}
