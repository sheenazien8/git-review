import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Search } from "lucide-react"
import { statusBadgeColor, statusIcon } from "@/features/files/status-display"
import type { GitFile } from "@/lib/git/types"
import { cn } from "@/lib/utils"
import { matchSegments, parseQuery } from "./fuzzy"
import { type QuickOpenItem, useQuickOpenItems } from "./use-quick-open"

const STATUS_LETTER: Record<string, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  untracked: "U",
  renamed: "R",
  conflicted: "C",
}

interface QuickOpenProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Every openable repo file (git-ignored ones left out).
  files: readonly string[]
  // Recently opened files, most recent first.
  recent: readonly string[]
  changed: readonly GitFile[]
  // Opens the file (scrolled to `line` when given).
  onOpen: (path: string, line?: number) => void
}

// Ctrl/Cmd+P "Go to file" palette, VS Code style: fuzzy-find a repo file
// by name, ↑/↓ to pick, Enter to open. "path:42" also jumps to line 42.
export function QuickOpen({ open, onOpenChange, ...props }: QuickOpenProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[10vh] z-50 flex w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Go to file</DialogPrimitive.Title>
          {/* Mounted only while open, so the query resets every time. */}
          <QuickOpenBody {...props} onClose={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function QuickOpenBody({ files, recent, changed, onOpen, onClose }: Omit<QuickOpenProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  // The selection resets whenever the query changes.
  const [{ query, selected }, setState] = useState({ query: "", selected: 0 })
  const { items, line, empty, statusOf } = useQuickOpenItems({ query, files, recent, changed })
  const listRef = useRef<HTMLDivElement>(null)
  const index = Math.min(selected, Math.max(items.length - 1, 0))

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" })
  }, [index])

  const choose = (item: QuickOpenItem | undefined) => {
    if (!item) return
    onClose()
    onOpen(item.path, parseQuery(query).line)
  }

  const move = (delta: number) => {
    if (items.length === 0) return
    setState(s => ({ ...s, selected: (index + delta + items.length) % items.length }))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const ctrl = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    if (e.key === "ArrowDown" || (ctrl && key === "n")) move(1)
    else if (e.key === "ArrowUp" || (ctrl && key === "p")) move(-1)
    else if (e.key === "PageDown") move(10)
    else if (e.key === "PageUp") move(-10)
    else if (e.key === "Enter") choose(items[index])
    else {
      // Keep app shortcuts (Ctrl+W, Ctrl+Tab, …) from firing behind the palette.
      if (ctrl) e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={e => setState({ query: e.target.value, selected: 0 })}
          onKeyDown={onKeyDown}
          placeholder="Search files by name (append :line to go to a line)"
          role="combobox"
          aria-expanded
          aria-controls="quick-open-list"
          aria-activedescendant={items.length > 0 ? `quick-open-${index}` : undefined}
          spellCheck={false}
          autoComplete="off"
          className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <div ref={listRef} id="quick-open-list" role="listbox" className="max-h-[min(60vh,26rem)] overflow-y-auto py-1">
        {empty && items.length > 0 && <p className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Recently opened &amp; changed</p>}
        {items.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">{empty ? "Type to search files" : "No matching files"}</p>}
        {items.map((item, i) => (
          <QuickOpenRow
            key={item.path}
            item={item}
            index={i}
            selected={i === index}
            status={statusOf.get(item.path)}
            onHover={() => setState(s => (s.selected === i ? s : { ...s, selected: i }))}
            onChoose={() => choose(item)}
          />
        ))}
      </div>
      {line !== undefined && items.length > 0 && (
        <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">Opens at line {line}</p>
      )}
    </>
  )
}

function QuickOpenRow({ item, index, selected, status, onHover, onChoose }: {
  item: QuickOpenItem
  index: number
  selected: boolean
  status: string | undefined
  onHover: () => void
  onChoose: () => void
}) {
  const { path, positions = [] } = item
  const nameStart = path.lastIndexOf("/") + 1
  const dir = path.slice(0, Math.max(nameStart - 1, 0))

  return (
    <div
      id={`quick-open-${index}`}
      data-index={index}
      role="option"
      aria-selected={selected}
      onMouseMove={onHover}
      // Keep focus in the input.
      onMouseDown={e => e.preventDefault()}
      onClick={onChoose}
      className={cn(
        "flex cursor-pointer items-center gap-2 px-3 py-1 text-sm",
        selected ? "bg-accent text-accent-foreground" : "text-foreground"
      )}
    >
      <span className="shrink-0 text-muted-foreground">{statusIcon(status ?? "")}</span>
      <span className="shrink-0 whitespace-pre font-medium">
        <Segments path={path} positions={positions} from={nameStart} to={path.length} />
      </span>
      {dir && (
        <span className="min-w-0 truncate whitespace-pre text-xs text-muted-foreground" title={path}>
          <Segments path={path} positions={positions} from={0} to={dir.length} />
        </span>
      )}
      {status && (
        <span className={cn("ml-auto shrink-0 rounded border px-1 text-[10px] font-semibold", statusBadgeColor(status))}>
          {STATUS_LETTER[status] ?? "?"}
        </span>
      )}
    </div>
  )
}

function Segments({ path, positions, from, to }: { path: string; positions: readonly number[]; from: number; to: number }) {
  return matchSegments(path, positions, from, to).map((seg, i) =>
    seg.match
      ? <mark key={i} className="rounded-[2px] bg-primary/15 font-semibold text-foreground">{seg.text}</mark>
      : <span key={i}>{seg.text}</span>
  )
}
