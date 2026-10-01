import { useCallback, useEffect, useRef, useState } from "react"
import { ancestorDirs } from "./tree"

const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 400
const SIDEBAR_DEFAULT_WIDTH = 280
const SIDEBAR_WIDTH_KEY = "hunk-sidebar-width"
const SIDEBAR_OPEN_KEY = "hunk-sidebar-open"

export function clampSidebarWidth(w: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(w)))
}

// VS Code-style sidebar: open state and width persisted to localStorage,
// drag-to-resize, and a separate Sheet overlay on mobile.
export function useSidebar() {
  const [open, setOpen] = useState(true)
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Restore persisted geometry once on mount. SSR renders the defaults, so
  // persisted values can only be applied after hydration.
  useEffect(() => {
    try {
      const storedWidth = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? "", 10)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted UI geometry from localStorage after hydration; SSR must render defaults
      if (!Number.isNaN(storedWidth)) setWidth(clampSidebarWidth(storedWidth))
      const storedOpen = localStorage.getItem(SIDEBAR_OPEN_KEY)
      if (storedOpen !== null) setOpen(storedOpen === "true")
    } catch {
      // localStorage unavailable — defaults are fine
    }
  }, [])

  // Persist the open state on every change, skipping the first (still
  // default) render so the restored value is never clobbered.
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    try {
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(open))
    } catch {}
  }, [open])

  const toggle = useCallback(() => setOpen(o => !o), [])

  // Drag the sidebar's right edge to resize (clamped, persisted on release).
  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width
    let current = startWidth
    setIsResizing(true)
    document.body.style.userSelect = "none"
    document.body.style.cursor = "col-resize"
    const onMove = (ev: PointerEvent) => {
      current = clampSidebarWidth(startWidth + ev.clientX - startX)
      setWidth(current)
    }
    const onUp = () => {
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
      setIsResizing(false)
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(current))
      } catch {}
    }
    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
  }, [width])

  const resetWidth = useCallback(() => setWidth(SIDEBAR_DEFAULT_WIDTH), [])

  return { open, toggle, width, isResizing, startResize, resetWidth, mobileOpen, setMobileOpen }
}

export type Sidebar = ReturnType<typeof useSidebar>

// Expanded directory paths in the sidebar trees.
export function useExpandedDirs() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((dirPath: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(dirPath)) next.delete(dirPath)
      else next.add(dirPath)
      return next
    })
  }, [])

  // Expands every ancestor of `filePath` so the file stays visible in the tree.
  const expandAncestors = useCallback((filePath: string) => {
    setExpanded(prev => {
      const missing = ancestorDirs(filePath).filter(d => !prev.has(d))
      return missing.length === 0 ? prev : new Set([...prev, ...missing])
    })
  }, [])

  const reset = useCallback(() => setExpanded(new Set()), [])

  return { expanded, toggle, expandAncestors, reset }
}

export type ExpandedDirs = ReturnType<typeof useExpandedDirs>
