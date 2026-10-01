import { useCallback, useDeferredValue, useMemo, useState } from "react"
import type { GitFile } from "@/lib/git/types"
import { type FuzzyMatch, parseQuery, rankPaths } from "./fuzzy"

const LIMIT = 50

export interface QuickOpenItem extends Partial<FuzzyMatch> {
  path: string
}

// Open state for the Quick Open palette.
export function useQuickOpen() {
  const [open, setOpen] = useState(false)
  const show = useCallback(() => setOpen(true), [])
  return { open, setOpen, show }
}

// What the palette lists for `query`: fuzzy matches over every repo file
// (plus changed files, so deleted ones can still be opened), or — with an
// empty query — recently opened files, then changed files.
export function useQuickOpenItems({ query, files, recent, changed }: {
  query: string
  files: readonly string[]
  // Most recent first.
  recent: readonly string[]
  changed: readonly GitFile[]
}) {
  // Ranking runs on the deferred query so typing stays smooth in big repos.
  const deferred = useDeferredValue(query)
  const { text, line } = parseQuery(deferred)

  const changedPaths = useMemo(() => [...new Set(changed.map(f => f.path))], [changed])
  const allPaths = useMemo(() => {
    const known = new Set(files)
    return [...files, ...changedPaths.filter(p => !known.has(p))]
  }, [files, changedPaths])

  const items = useMemo<QuickOpenItem[]>(() => {
    if (text.trim()) return rankPaths(allPaths, text, LIMIT)
    return [...new Set([...recent, ...changedPaths])].slice(0, LIMIT).map(path => ({ path }))
  }, [allPaths, text, recent, changedPaths])

  // Status per path for the badges; an unstaged entry wins over a staged one.
  const statusOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of changed) if (!f.staged || !map.has(f.path)) map.set(f.path, f.status)
    return map
  }, [changed])

  return { items, line, empty: !text.trim(), statusOf, stale: deferred !== query }
}
