import { useCallback, useState } from "react"
import { api } from "@/lib/api-client"
import type { GitFile, RepoEntry } from "@/lib/git/types"

// Git status (changed files + branch) and the All Files listing for a repo.
export function useGitStatus(repoPath: string) {
  const [files, setFiles] = useState<GitFile[]>([])
  const [branch, setBranch] = useState("")
  const [allFiles, setAllFiles] = useState<RepoEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadAllFiles = useCallback(async (repo?: string) => {
    try {
      setAllFiles((await api.allFiles(repo ?? repoPath)).files || [])
    } catch {
      // silently fail — this is auxiliary
    }
  }, [repoPath])

  // Returns the fresh file list, or null when loading failed.
  const loadStatus = useCallback(async (repo?: string): Promise<GitFile[] | null> => {
    const target = repo ?? repoPath
    setLoading(true)
    setError("")
    try {
      const data = await api.status(target)
      setFiles(data.files || [])
      setBranch(data.branch || "")
      await loadAllFiles(target)
      return data.files || []
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git status")
      return null
    } finally {
      setLoading(false)
    }
  }, [repoPath, loadAllFiles])

  // Drops the previous repo's lists while switching repos.
  const clear = useCallback(() => {
    setFiles([])
    setAllFiles([])
  }, [])

  return { files, branch, allFiles, loading, error, loadStatus, loadAllFiles, clear }
}
