import type { Worktree } from "./types"

// Parses `git worktree list --porcelain -z`: NUL-terminated "key value"
// attribute lines, with an empty field between worktrees.
export function parseWorktrees(output: string): Worktree[] {
  const worktrees: Worktree[] = []
  let current: Worktree | null = null

  for (const field of output.split("\0")) {
    if (!field) {
      current = null
      continue
    }
    const space = field.indexOf(" ")
    const key = space === -1 ? field : field.slice(0, space)
    const value = space === -1 ? "" : field.slice(space + 1)

    if (key === "worktree") {
      current = {
        path: value,
        head: "",
        main: worktrees.length === 0,
        detached: false,
        bare: false,
        locked: false,
        prunable: false,
      }
      worktrees.push(current)
      continue
    }
    if (!current) continue
    switch (key) {
      case "HEAD": current.head = value; break
      case "branch": current.branch = value.replace(/^refs\/heads\//, ""); break
      case "detached": current.detached = true; break
      case "bare": current.bare = true; break
      case "locked": current.locked = true; break
      case "prunable": current.prunable = true; break
    }
  }

  return worktrees
}
