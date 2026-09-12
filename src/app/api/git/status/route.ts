import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

interface GitFile {
  path: string
  status: string
  staged: boolean
  oldPath?: string
}

// Status of a change that only exists in the index (staged)
function indexStatus(c: string): string {
  switch (c) {
    case "A": return "added"
    case "D": return "deleted"
    case "R": return "renamed"
    case "C": return "added"
    case "M":
    case "T": return "modified"
    default: return "modified"
  }
}

// Status of a change between the index and the worktree (unstaged)
function worktreeStatus(c: string): string {
  switch (c) {
    case "D": return "deleted"
    case "M":
    case "T": return "modified"
    default: return "modified"
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const repo = searchParams.get("repo") || "/mnt/storage/Documents/Code/antikode/yamaha-golang-api"

  try {
    const [statusOut, branchOut] = await Promise.all([
      execAsync(`git status --porcelain -uall`, { cwd: repo, maxBuffer: 10 * 1024 * 1024 }),
      execAsync(`git branch --show-current`, { cwd: repo }),
    ])

    const lines = statusOut.stdout.split("\n").filter(Boolean)
    const files: GitFile[] = []

    for (const line of lines) {
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
        files.push({ path: filePath, status: indexStatus(index), staged: true, oldPath: renameFrom })
      }
      if (worktree !== " ") {
        files.push({
          path: filePath,
          status: worktreeStatus(worktree),
          staged: false,
          oldPath: index !== " " ? undefined : renameFrom,
        })
      }
    }

    return NextResponse.json({ files, branch: branchOut.stdout.trim() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load git status" }, { status: 500 })
  }
}