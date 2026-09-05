import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

const DEFAULT_REPO = "/mnt/storage/Documents/Code/antikode/yamaha-golang-api"

interface ActionBody {
  action: "add" | "addAll" | "unstage" | "unstageAll" | "commit" | "push"
  repo?: string
  files?: string[]
  message?: string
}

const MAX_BUFFER = 10 * 1024 * 1024

function output(r: { stdout: string; stderr: string }) {
  return (r.stdout || r.stderr).trim()
}

// `git reset --` cannot unstage in a repo that has no commits yet (no HEAD to
// reset to) — there `git rm --cached` is the correct way to empty the index.
function isUnbornHead(e: unknown): boolean {
  const stderr = (e as { stderr?: string }).stderr || ""
  const msg = stderr || (e instanceof Error ? e.message : "")
  return /Failed to resolve 'HEAD'|unborn|bad revision|unknown revision/i.test(msg)
}

export async function POST(req: NextRequest) {
  let body: ActionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { action, files, message } = body
  const repo = body.repo || DEFAULT_REPO
  const opts = { cwd: repo, maxBuffer: MAX_BUFFER }

  try {
    switch (action) {
      case "add": {
        if (!files || files.length === 0) {
          return NextResponse.json({ error: "No file specified" }, { status: 400 })
        }
        // execFile passes args directly to git — no shell, no injection risk
        await execFileAsync("git", ["add", "--", ...files], opts)
        return NextResponse.json({ success: true, message: `Staged ${files.length} file${files.length > 1 ? "s" : ""}` })
      }

      case "addAll": {
        await execFileAsync("git", ["add", "-A"], opts)
        return NextResponse.json({ success: true, message: "Staged all changes" })
      }

      case "unstage": {
        if (!files || files.length === 0) {
          return NextResponse.json({ error: "No file specified" }, { status: 400 })
        }
        const unstaged = `Unstaged ${files.length} file${files.length > 1 ? "s" : ""}`
        try {
          await execFileAsync("git", ["reset", "-q", "--", ...files], opts)
        } catch (e) {
          if (!isUnbornHead(e)) throw e
          await execFileAsync("git", ["rm", "--cached", "-q", "--", ...files], opts)
        }
        return NextResponse.json({ success: true, message: unstaged })
      }

      case "unstageAll": {
        try {
          await execFileAsync("git", ["reset", "-q"], opts)
        } catch (e) {
          if (!isUnbornHead(e)) throw e
          await execFileAsync("git", ["rm", "-r", "--cached", "-q", "."], opts)
        }
        return NextResponse.json({ success: true, message: "Unstaged all changes" })
      }

      case "commit": {
        const msg = (message || "").trim()
        if (!msg) {
          return NextResponse.json({ error: "Commit message is required" }, { status: 400 })
        }
        const r = await execFileAsync("git", ["commit", "-m", msg], opts)
        return NextResponse.json({ success: true, message: output(r) || "Committed" })
      }

      case "push": {
        try {
          const r = await execFileAsync("git", ["push"], opts)
          return NextResponse.json({ success: true, message: output(r) || "Pushed" })
        } catch (e) {
          // Branch has no upstream yet — set it on first push
          const stderr = (e as { stderr?: string }).stderr || ""
          if (/no upstream|set-upstream/i.test(stderr)) {
            const r = await execFileAsync("git", ["push", "-u", "origin", "HEAD"], opts)
            return NextResponse.json({ success: true, message: output(r) || "Pushed (upstream set)" })
          }
          throw e
        }
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr
    const error = (stderr && stderr.trim()) || (e instanceof Error ? e.message : "Git action failed")
    return NextResponse.json({ error }, { status: 500 })
  }
}