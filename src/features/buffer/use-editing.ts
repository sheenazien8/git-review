import { useCallback, useState } from "react"
import { isBinaryFile } from "@/features/files/file-types"
import type { ActionResult } from "@/features/changes/use-git-actions"
import { api } from "@/lib/api-client"
import type { GitFile } from "@/lib/git/types"
import type { Buffer } from "./use-buffer"

// Edit mode for the active tab: entering/leaving it and saving to disk.
export function useEditing({ repoPath, buffer, files, loadStatus, setActionResult }: {
  repoPath: string
  buffer: Buffer
  files: GitFile[]
  loadStatus: () => Promise<unknown>
  setActionResult: (result: ActionResult | null) => void
}) {
  const { active, update, fetchRaw, fetchEntry } = buffer
  const [isSaving, setIsSaving] = useState(false)

  // Text files that still exist can be edited.
  const canEdit = useCallback((file: string | null) => {
    if (!file || isBinaryFile(file)) return false
    return files.find(f => f.path === file)?.status !== "deleted"
  }, [files])

  const toggleEditMode = useCallback(async () => {
    if (!active) return
    if (active.editMode) {
      update(active.id, { editMode: false, editContent: "", dirty: false })
      return
    }
    if (!canEdit(active.file)) return
    const content = !active.raw || active.rawError ? await fetchRaw(active) : active.raw
    update(active.id, {
      viewMode: "split",
      editMode: true,
      editContent: content,
      dirty: false,
      mdRender: false,
      findOpen: false,
    })
  }, [active, canEdit, fetchRaw, update])

  const saveFile = useCallback(async () => {
    if (!active || active.editContent === active.raw) return
    setIsSaving(true)
    setActionResult(null)
    try {
      await api.saveContent(repoPath, active.file, active.editContent)
      setActionResult({ ok: true, message: "File saved" })
      update(active.id, { editMode: false, editContent: "", dirty: false, raw: active.editContent })
      await loadStatus()
      // Re-fetch so the tab's diff reflects the saved state.
      await fetchEntry(active)
    } catch (e) {
      setActionResult({ ok: false, message: e instanceof Error ? e.message : "Failed to save file" })
    } finally {
      setIsSaving(false)
    }
  }, [active, repoPath, loadStatus, fetchEntry, update, setActionResult])

  return { canEdit, isSaving, toggleEditMode, saveFile }
}
