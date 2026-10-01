import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api-client"
import type { StashEntry } from "@/lib/git/types"

// Listing failures just leave the menu empty.
function fetchStashes(repo: string) {
  return api.stashes(repo).catch(() => [] as StashEntry[])
}

// The repo's stash list (shared by all its worktrees), reloaded whenever the
// repo changes and after stash actions.
export function useStash(repoPath: string) {
  const [stashes, setStashes] = useState<StashEntry[]>([])

  useEffect(() => {
    let current = true
    void fetchStashes(repoPath).then(list => {
      if (current) setStashes(list)
    })
    return () => {
      current = false
    }
  }, [repoPath])

  const load = useCallback(async () => {
    setStashes(await fetchStashes(repoPath))
  }, [repoPath])

  return { stashes, load }
}
