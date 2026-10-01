import { execFileSync } from "child_process"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs"
import os from "os"
import path from "path"

// Deterministic identity for commits made in temp repos.
Object.assign(process.env, {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
})

export interface TempRepo {
  dir: string
  git: (...args: string[]) => string
  write: (file: string, content: string) => void
  cleanup: () => void
}

export function createTempRepo(): TempRepo {
  const dir = mkdtempSync(path.join(os.tmpdir(), "hunk-test-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf-8" })
  git("init", "-q", "-b", "main")
  return {
    dir,
    git,
    write(file, content) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      writeFileSync(path.join(dir, file), content)
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}
