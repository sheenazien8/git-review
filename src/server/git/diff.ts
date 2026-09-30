import "server-only"
import type { DiffSide } from "@/lib/git/types"
import { EMPTY_TREE, git, isUnbornHead } from "./exec"
import { isUntracked } from "./status"

// Rename detection threshold. Passing both the old and new path positionally
// keeps detection on — git's path-only matching would otherwise hide renames.
const RENAMES = ["-M50", "--find-renames=50"]

export async function getDiff(
  repo: string,
  { file, oldPath, side }: { file: string; oldPath?: string; side: DiffSide }
): Promise<string> {
  const paths = oldPath && oldPath !== file ? [oldPath, file] : [file]

  if (await isUntracked(repo, file).catch(() => false)) {
    // --no-index exits 1 when the files differ, which is the expected case.
    return (await git(repo, ["diff", "--no-index", "/dev/null", file], { okExitCodes: [1] })).stdout
  }

  switch (side) {
    case "staged":
      // Index vs HEAD. Without any commits there is no HEAD, so diff against
      // the empty tree instead (the whole staged file shows as added).
      try {
        return (await git(repo, ["diff", "--cached", ...RENAMES, "--", ...paths])).stdout
      } catch (e) {
        if (!isUnbornHead(e)) throw e
        return (await git(repo, ["diff", "--cached", ...RENAMES, EMPTY_TREE, "--", ...paths])).stdout
      }
    case "unstaged":
      return (await git(repo, ["diff", ...RENAMES, "--", ...paths])).stdout
    case "head":
      return (await git(repo, ["diff", "HEAD", ...RENAMES, "--", ...paths])).stdout
  }
}
