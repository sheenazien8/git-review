import "server-only"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

export const MAX_BUFFER = 10 * 1024 * 1024

// `git hash-object -t tree /dev/null` — diffing the index against this shows
// every staged file as added when HEAD doesn't exist yet.
export const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

export interface GitResult {
  stdout: string
  stderr: string
}

interface GitOptions {
  maxBuffer?: number
  // Non-zero exit codes that still mean success (e.g. 1 for `diff --no-index`).
  okExitCodes?: number[]
}

// Runs git with an argument array — no shell, so paths are never interpreted.
export async function git(repo: string, args: string[], opts: GitOptions = {}): Promise<GitResult> {
  try {
    return await execFileAsync("git", args, { cwd: repo, maxBuffer: opts.maxBuffer ?? MAX_BUFFER })
  } catch (e) {
    const err = e as { code?: unknown; stdout?: string; stderr?: string }
    if (typeof err.code === "number" && opts.okExitCodes?.includes(err.code)) {
      return { stdout: err.stdout ?? "", stderr: err.stderr ?? "" }
    }
    throw e
  }
}

// True when a git error was caused by HEAD not existing yet (no commits).
export function isUnbornHead(e: unknown): boolean {
  const stderr = (e as { stderr?: string } | null)?.stderr || ""
  const msg = stderr || (e instanceof Error ? e.message : "")
  return /Failed to resolve 'HEAD'|unborn|bad revision|unknown revision/i.test(msg)
}

export function output(r: GitResult): string {
  return (r.stdout || r.stderr).trim()
}
