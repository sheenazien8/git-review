import type { StashEntry } from "./types"

// `git stash list` format for parseStash: one stash per line, NUL-separated
// "stash@{n}", commit sha, reflog subject, author date.
export const STASH_FORMAT = "--format=%gd%x00%H%x00%gs%x00%aI"

export function parseStash(output: string): StashEntry[] {
  const stashes: StashEntry[] = []
  for (const line of output.split("\n")) {
    const [ref, sha, message, date] = line.split("\0")
    const index = /^stash@\{(\d+)\}$/.exec(ref ?? "")
    if (!index || !sha) continue
    // "WIP on main: …" (default message) or "On main: <message>".
    const branch = /^(?:WIP on|On) (.+?): /.exec(message ?? "")?.[1]
    stashes.push({ index: Number(index[1]), sha, message: message ?? "", branch, date: date ?? "" })
  }
  return stashes
}
