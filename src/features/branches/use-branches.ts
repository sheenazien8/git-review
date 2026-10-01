import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api-client"
import type { BranchesResponse } from "@/lib/git/types"

const EMPTY: BranchesResponse = { current: "", branches: [] }

// Listing failures just leave the picker empty.
function fetchBranches(repo: string) {
  return api.branches(repo).catch(() => EMPTY)
}

// Local + remote branches of the active repo/worktree, reloaded whenever it
// changes and after branch actions.
export function useBranches(repoPath: string) {
  const [data, setData] = useState<BranchesResponse>(EMPTY)

  useEffect(() => {
    let current = true
    void fetchBranches(repoPath).then(d => {
      if (current) setData(d)
    })
    return () => {
      current = false
    }
  }, [repoPath])

  const load = useCallback(async () => {
    setData(await fetchBranches(repoPath))
  }, [repoPath])

  return { current: data.current, branches: data.branches, load }
}

// The local branch a remote one ("origin/feat") maps to ("feat").
export function localNameOf(remoteBranch: string) {
  return remoteBranch.slice(remoteBranch.indexOf("/") + 1)
}
