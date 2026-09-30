import "server-only"
import { parseStatus } from "@/lib/git/parse-status"
import type { StatusResponse } from "@/lib/git/types"
import { git } from "./exec"

export async function getStatus(repo: string): Promise<StatusResponse> {
  const [status, branch] = await Promise.all([
    git(repo, ["status", "--porcelain", "-uall"]),
    git(repo, ["branch", "--show-current"]),
  ])
  return { files: parseStatus(status.stdout), branch: branch.stdout.trim() }
}

export async function isUntracked(repo: string, file: string): Promise<boolean> {
  const r = await git(repo, ["status", "--porcelain", "-uall", "--", file])
  return r.stdout.startsWith("??")
}
