import { useCallback, useMemo } from "react"
import type { BufferEntry } from "@/features/buffer/buffer"
import { isMarkdownFile } from "@/features/files/file-types"
import { findMatches } from "./find"

// The text the find bar searches — whatever the active view is showing.
function searchText(entry: BufferEntry): string {
  if (entry.editMode) return entry.editContent
  if (entry.fromAll) return entry.raw
  if (isMarkdownFile(entry.file) && entry.mdRender) return entry.raw
  if (entry.viewMode === "raw") return entry.raw
  return entry.diff
}

// In-file find for the active tab. The find state lives on the tab itself.
export function useFind(active: BufferEntry | null, update: (id: string, patch: Partial<BufferEntry>) => void) {
  const text = active ? searchText(active) : ""
  const total = useMemo(
    () => findMatches(text, active?.findQuery || "", active?.findCaseSensitive || false).length,
    [text, active?.findQuery, active?.findCaseSensitive]
  )

  const patchActive = useCallback((patch: Partial<BufferEntry>) => {
    if (active) update(active.id, patch)
  }, [active, update])

  const open = useCallback(() => patchActive({ findOpen: true, findMatchIndex: 0 }), [patchActive])
  const close = useCallback(() => patchActive({ findOpen: false }), [patchActive])
  const setQuery = useCallback((value: string) => patchActive({ findQuery: value, findMatchIndex: 0 }), [patchActive])
  const setIndex = useCallback((value: number) => patchActive({ findMatchIndex: value }), [patchActive])

  const toggleCase = useCallback(() => {
    if (active) update(active.id, { findCaseSensitive: !active.findCaseSensitive, findMatchIndex: 0 })
  }, [active, update])

  const next = useCallback(() => {
    if (active && total > 0) update(active.id, { findMatchIndex: (active.findMatchIndex + 1) % total })
  }, [active, total, update])

  const prev = useCallback(() => {
    if (active && total > 0) update(active.id, { findMatchIndex: (active.findMatchIndex - 1 + total) % total })
  }, [active, total, update])

  return { total, open, close, setQuery, setIndex, toggleCase, next, prev }
}

export type Find = ReturnType<typeof useFind>
