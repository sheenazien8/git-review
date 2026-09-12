import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const repo = searchParams.get("repo") || "/mnt/storage/Documents/Code/antikode/yamaha-golang-api"
  const file = searchParams.get("file") || ""
  // "0" = unstaged side, "1" = staged side; absent = legacy (diff vs HEAD)
  const staged = searchParams.get("staged")
  // Source path when `file` is a rename target — git's path-only matching hides
  // renames, so we pass both paths positionally with `-M50` to keep detection on.
  const oldPath = searchParams.get("oldPath") || ""

  if (!file) {
    return NextResponse.json({ error: "No file specified" }, { status: 400 })
  }

  const diffArgs = [oldPath, file].filter(Boolean)

  try {
    // Detect if file is untracked
    const isUntracked = await execAsync(
      `git status --porcelain -- "${file}"`,
      { cwd: repo, maxBuffer: 10 * 1024 * 1024 }
    ).then(r => r.stdout.startsWith("??")).catch(() => false)

    let stdout: string
    if (isUntracked) {
      // git diff --no-index exits with code 1 when differences exist (not an error)
      try {
        const r = await execAsync(`git diff --no-index /dev/null "${file}"`, {
          cwd: repo,
          maxBuffer: 10 * 1024 * 1024,
        })
        stdout = r.stdout
      } catch (e: unknown) {
        // Exit code 1 means differences found — output is in error.stdout
        stdout = (e as { stdout?: string }).stdout || ""
      }
    } else if (staged === "1") {
      // Index vs HEAD. In a repo with no commits yet there is no HEAD, so diff
      // against the empty tree instead (the whole staged file shows as added).
      try {
        stdout = (await execAsync(
          `git diff --cached -M50 --find-renames=50 -- ${diffArgs.map(a => `"${a}"`).join(" ")}`,
          { cwd: repo, maxBuffer: 10 * 1024 * 1024 }
        )).stdout
      } catch (e) {
        const stderr = (e as { stderr?: string }).stderr || ""
        if (!/Failed to resolve 'HEAD'|bad revision|unknown revision/i.test(stderr)) throw e
        stdout = (await execAsync(
          `git diff --cached -M50 --find-renames=50 4b825dc642cb6eb9a060e54bf8d69288fbee4904 -- ${diffArgs.map(a => `"${a}"`).join(" ")}`,
          { cwd: repo, maxBuffer: 10 * 1024 * 1024 }
        )).stdout
      }
    } else if (staged === "0") {
      // Worktree vs index — exactly the unstaged portion
      stdout = (await execAsync(
        `git diff -M50 --find-renames=50 -- ${diffArgs.map(a => `"${a}"`).join(" ")}`,
        { cwd: repo, maxBuffer: 10 * 1024 * 1024 }
      )).stdout
    } else {
      // Legacy: diff against HEAD so both staged and unstaged changes show.
      const r = await execAsync(
        `git diff HEAD -M50 --find-renames=50 -- ${diffArgs.map(a => `"${a}"`).join(" ")}`,
        { cwd: repo, maxBuffer: 10 * 1024 * 1024 }
      )
      stdout = r.stdout
    }

    return NextResponse.json({ diff: stdout })
  } catch {
    return NextResponse.json({ diff: "" })
  }
}
