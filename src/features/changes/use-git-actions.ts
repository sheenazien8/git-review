import { useCallback, useState } from "react"
import { api } from "@/lib/api-client"
import type { ActionName, ActionPayload } from "@/lib/git/types"

export interface ActionResult {
  ok: boolean
  message: string
}

// Runs /api/git/action calls, tracking the in-flight action and the last
// result message shown in the header. `onSuccess` reconciles UI state
// (refresh status, fix up tabs) after a successful action. `runAction`
// resolves to whether the action succeeded.
export function useGitActions(
  repoPath: string,
  onSuccess: (action: ActionName, payload?: ActionPayload) => Promise<void>
) {
  const [busyAction, setBusyAction] = useState<ActionName | null>(null)
  const [actionResult, setActionResult] = useState<ActionResult | null>(null)

  const runAction = useCallback(async (action: ActionName, payload?: ActionPayload): Promise<boolean> => {
    setBusyAction(action)
    setActionResult(null)
    try {
      const message = await api.action(repoPath, action, payload)
      setActionResult({ ok: true, message: message || "Done" })
    } catch (e) {
      setActionResult({ ok: false, message: e instanceof Error ? e.message : "Action failed" })
      setBusyAction(null)
      return false
    }
    try {
      await onSuccess(action, payload)
    } catch (e) {
      setActionResult({ ok: false, message: e instanceof Error ? e.message : "Action failed" })
    } finally {
      setBusyAction(null)
    }
    return true
  }, [repoPath, onSuccess])

  return { busyAction, actionResult, setActionResult, runAction }
}

export function isDiscardAction(action: ActionName | null) {
  return action === "discard" || action === "discardAll" || action === "discardStaged"
}
