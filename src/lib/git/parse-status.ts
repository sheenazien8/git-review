import type { FileStatus, GitFile } from "./types"

// Status of a change that only exists in the index (staged)
function indexStatus(c: string): FileStatus {
  switch (c) {
    case "A": return "added"
    case "D": return "deleted"
    case "R": return "renamed"
    case "C": return "added"
    default: return "modified"
  }
}

// Status of a change between the index and the worktree (unstaged)
function worktreeStatus(c: string): FileStatus {
  return c === "D" ? "deleted" : "modified"
}

// Parses `git status --porcelain` (v1) output.
export function parseStatus(output: string): GitFile[] {
  const files: GitFile[] = []

  for (const line of output.split("\n").filter(Boolean)) {
    const index = line[0]
    const worktree = line[1]
    const path = line.slice(3)

    if (index === "?" && worktree === "?") {
      files.push({ path, status: "untracked", staged: false })
      continue
    }

    const [renameFrom, newPath] = path.split(" -> ")
    const filePath = newPath || path

    // A file can have both staged and unstaged changes ("MM", "AM", …) —
    // emit one entry per side so the UI can show them in separate sections.
    if (index !== " ") {
      files.push({ path: filePath, status: indexStatus(index), staged: true, oldPath: newPath ? renameFrom : undefined })
    }
    if (worktree !== " ") {
      files.push({
        path: filePath,
        status: worktreeStatus(worktree),
        staged: false,
        oldPath: index !== " " || !newPath ? undefined : renameFrom,
      })
    }
  }

  return files
}
