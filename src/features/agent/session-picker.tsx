import { useEffect, useRef, useState } from "react"
import { ChevronDown, Circle, History, Loader2, Search } from "lucide-react"
import type { AgentSessionSummary } from "@/lib/acp/types"
import { cn } from "@/lib/utils"
import { useSessionList } from "./use-session-list"

function timeAgo(iso: string | undefined): string {
  if (!iso) return ""
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (!Number.isFinite(minutes)) return ""
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days}d` : new Date(iso).toLocaleDateString()
}

function Row({ session, current, onPick }: { session: AgentSessionSummary; current: boolean; onPick: (id: string) => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={current}
      onClick={() => onPick(session.sessionId)}
      title={session.title}
      className={cn(
        "flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent focus:bg-accent focus:outline-none",
        current && "bg-accent font-medium"
      )}
    >
      {session.live
        ? <Circle size={8} className={cn("shrink-0", session.busy ? "fill-primary text-primary" : "text-muted-foreground")} />
        : <History size={12} className="shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate">{session.title}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(session.updatedAt)}</span>
    </button>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

// Session selector: a popover instead of a native <select>, so past
// sessions can load page by page as the list scrolls (and be filtered)
// rather than all before the menu can open.
export function SessionPicker({ repo, agentId, sessionId, title, disabled, onPick }: {
  repo: string
  agentId: string
  sessionId: string | null
  title: string
  disabled: boolean
  onPick: (id: string) => void
}) {
  const list = useSessionList(repo, agentId)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const show = () => {
    setFilter("")
    list.reload()
    setOpen(true)
  }

  const close = () => setOpen(false)

  const pick = (id: string) => {
    close()
    onPick(id)
  }

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open])

  // Next page when the end of the list scrolls into view. A filter that
  // leaves the list short keeps the sentinel visible, so it keeps loading.
  const { loadMore } = list
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!open || !sentinel) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) loadMore()
    }, { root: scrollRef.current, rootMargin: "120px" })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, loadMore, list.past.length])

  const q = filter.trim().toLowerCase()
  const matches = (s: AgentSessionSummary) => !q || s.title.toLowerCase().includes(q)
  const live = list.live.filter(matches)
  const past = list.past.filter(matches)
  const empty = live.length === 0 && past.length === 0 && !list.loadingLive && !list.loadingPast && !list.hasMore

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        title={title || "Session"}
        className="flex h-8 w-full min-w-0 items-center gap-1 rounded-md border border-input bg-background px-2 text-left text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        <span className={cn("min-w-0 flex-1 truncate", !sessionId && "text-muted-foreground")}>
          {sessionId ? title || sessionId.slice(0, 8) : agentId ? "Select a session…" : "Loading agents…"}
        </span>
        <ChevronDown size={14} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 flex max-h-[60vh] min-w-64 flex-col rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="relative border-b border-border p-1.5">
            <Search size={12} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter sessions…"
              className="h-7 w-full rounded border border-input bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div ref={scrollRef} role="listbox" aria-label="Sessions" className="min-h-0 flex-1 overflow-y-auto p-1">
            {live.length > 0 && (
              <Group label="Open">
                {live.map(s => <Row key={s.sessionId} session={s} current={s.sessionId === sessionId} onPick={pick} />)}
              </Group>
            )}
            {past.length > 0 && (
              <Group label="Resume">
                {past.map(s => <Row key={s.sessionId} session={s} current={s.sessionId === sessionId} onPick={pick} />)}
              </Group>
            )}
            {empty && <div className="px-2 py-3 text-center text-xs text-muted-foreground">{q ? "No matching sessions" : "No sessions yet"}</div>}
            {list.error && <div className="px-2 py-2 text-xs text-destructive">{list.error}</div>}
            <div ref={sentinelRef} className="h-px" />
            {(list.loadingPast || list.loadingLive) && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" /> Loading sessions…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
