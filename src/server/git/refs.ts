import "server-only"
import { HttpError } from "../http"
import { git } from "./exec"

// A branch/ref name from a request. Rejects a leading "-" so it can never be
// read as an option, even where git doesn't accept "--" before it.
export function requireRef(value: string | undefined, what: string): string {
  const ref = (value || "").trim()
  if (!ref) throw new HttpError(400, `${what} is required`)
  if (ref.startsWith("-")) throw new HttpError(400, `Invalid ${what.toLowerCase()}: ${ref}`)
  return ref
}

// A full or abbreviated commit sha — nothing else (no ref expressions).
export function requireSha(value: string | null | undefined, what = "Commit"): string {
  const sha = (value || "").trim()
  if (!/^[0-9a-f]{4,64}$/i.test(sha)) throw new HttpError(400, `Invalid ${what.toLowerCase()}: ${sha}`)
  return sha
}

// A name that `git branch` would accept for a new branch.
export async function requireNewBranchName(repo: string, value: string | undefined): Promise<string> {
  const branch = requireRef(value, "Branch")
  try {
    await git(repo, ["check-ref-format", "--branch", branch])
  } catch {
    throw new HttpError(400, `Invalid branch name: ${branch}`)
  }
  return branch
}

export async function refExists(repo: string, ref: string): Promise<boolean> {
  try {
    await git(repo, ["show-ref", "--verify", "--quiet", ref])
    return true
  } catch {
    return false
  }
}
