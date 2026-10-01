import { useCallback, useRef, useState } from "react"
import { api } from "@/lib/api-client"
import type { CommitFile } from "@/lib/git/types"

export interface FileDiff {
  diff: string
  error: string
}

// Per-file diffs of one commit, fetched on demand (when a file is expanded)
// and kept for the lifetime of the view.
export function useCommitDiffs(repo: string, sha: string) {
  const [diffs, setDiffs] = useState<Record<string, FileDiff>>({})
  const requestedRef = useRef<Set<string>>(new Set())

  const load = useCallback(async (file: CommitFile) => {
    if (requestedRef.current.has(file.path)) return
    requestedRef.current.add(file.path)
    let result: FileDiff
    try {
      result = { diff: await api.commitDiff(repo, sha, file.path, file.oldPath), error: "" }
    } catch (e) {
      result = { diff: "", error: e instanceof Error ? e.message : "Failed to load diff" }
      requestedRef.current.delete(file.path)
    }
    setDiffs(prev => ({ ...prev, [file.path]: result }))
  }, [repo, sha])

  return { diffs, load }
}
