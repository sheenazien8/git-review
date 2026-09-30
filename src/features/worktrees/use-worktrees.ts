import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api-client"
import type { Worktree, WorktreesResponse } from "@/lib/git/types"

const EMPTY: WorktreesResponse = { worktrees: [], branches: [] }

// Listing failures just leave the selector empty.
function fetchWorktrees(projectDir: string) {
  return api.worktrees(projectDir).catch(() => EMPTY)
}

// Worktrees and local branches of the selected project, reloaded whenever the
// project changes.
export function useWorktrees(projectDir: string) {
  const [data, setData] = useState<WorktreesResponse>(EMPTY)

  useEffect(() => {
    let current = true
    void fetchWorktrees(projectDir).then(d => {
      if (current) setData(d)
    })
    return () => {
      current = false
    }
  }, [projectDir])

  const load = useCallback(async () => {
    setData(await fetchWorktrees(projectDir))
  }, [projectDir])

  const worktrees: Worktree[] = data.worktrees
  return { worktrees, branches: data.branches, load }
}
