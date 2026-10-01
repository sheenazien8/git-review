import "server-only"
import { parseBlame } from "@/lib/git/parse-blame"
import type { BlameResponse } from "@/lib/git/types"
import { resolveInRepo } from "../repo"
import { git } from "./exec"
import { requireSha } from "./refs"

// Blames the working-tree file, or the file as of commit `ref`.
export async function getBlame(repo: string, file: string, ref?: string): Promise<BlameResponse> {
  resolveInRepo(repo, file)
  const rev = ref ? [requireSha(ref, "Ref")] : []
  return parseBlame((await git(repo, ["blame", "--porcelain", ...rev, "--", file])).stdout)
}
