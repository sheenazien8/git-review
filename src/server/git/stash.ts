import "server-only"
import { parseStash, STASH_FORMAT } from "@/lib/git/parse-stash"
import type { ActionPayload, StashResponse } from "@/lib/git/types"
import { HttpError } from "../http"
import { git, output } from "./exec"

export async function listStashes(repo: string): Promise<StashResponse> {
  return { stashes: parseStash((await git(repo, ["stash", "list", STASH_FORMAT])).stdout) }
}

function stashRef(payload: ActionPayload): string {
  const { index } = payload
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0) {
    throw new HttpError(400, "Invalid stash index")
  }
  return `stash@{${index}}`
}

export async function stash(repo: string, payload: ActionPayload): Promise<string> {
  const message = (payload.message || "").trim()
  const args = ["stash", "push"]
  if (payload.includeUntracked) args.push("--include-untracked")
  if (message) args.push("-m", message)
  const r = output(await git(repo, args))
  // Exits 0 with this message when there was nothing to stash.
  if (/No local changes to save/i.test(r)) throw new HttpError(400, "No local changes to stash")
  return r || "Stashed changes"
}

export async function stashPop(repo: string, payload: ActionPayload): Promise<string> {
  const ref = stashRef(payload)
  await git(repo, ["stash", "pop", ref])
  return `Popped ${ref}`
}

export async function stashApply(repo: string, payload: ActionPayload): Promise<string> {
  const ref = stashRef(payload)
  await git(repo, ["stash", "apply", ref])
  return `Applied ${ref}`
}

export async function stashDrop(repo: string, payload: ActionPayload): Promise<string> {
  const ref = stashRef(payload)
  return output(await git(repo, ["stash", "drop", ref])) || `Dropped ${ref}`
}
