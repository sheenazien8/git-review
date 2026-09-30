import "server-only"
import path from "path"
import { readFile, realpath } from "fs/promises"
import { parseWorktrees } from "@/lib/git/parse-worktrees"
import type { ActionPayload, Worktree, WorktreesResponse } from "@/lib/git/types"
import { allowAnyRepo } from "../config"
import { HttpError } from "../http"
import { git, output } from "./exec"

export async function listWorktrees(repo: string): Promise<Worktree[]> {
  return parseWorktrees((await git(repo, ["worktree", "list", "--porcelain", "-z"])).stdout)
}

export async function getWorktrees(repo: string): Promise<WorktreesResponse> {
  const [worktrees, refs] = await Promise.all([
    listWorktrees(repo),
    git(repo, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]),
  ])
  return { worktrees, branches: refs.stdout.split("\n").filter(Boolean) }
}

// Symlink-insensitive path identity; falls back to the lexical path when the
// directory no longer exists (prunable worktrees).
async function canonical(p: string): Promise<string> {
  try {
    return await realpath(p)
  } catch {
    return path.resolve(p)
  }
}

async function findWorktree(worktrees: Worktree[], dir: string): Promise<Worktree | undefined> {
  const target = await canonical(dir)
  for (const w of worktrees) {
    if (await canonical(w.path) === target) return w
  }
  return undefined
}

// Main worktree of the repo a linked worktree belongs to, read from its `.git`
// file ("gitdir: <main>/.git/worktrees/<name>") without running git inside
// `dir` — it isn't trusted yet, and git would honor its config.
export async function mainWorktreeOf(dir: string): Promise<string | null> {
  let dotGit: string
  try {
    dotGit = await readFile(path.join(dir, ".git"), "utf-8")
  } catch {
    return null // missing, or a directory (a main worktree)
  }
  const match = /^gitdir:\s*(.+?)\s*$/m.exec(dotGit)?.[1]
  if (!match) return null
  const gitdir = path.resolve(dir, match)
  if (path.basename(path.dirname(gitdir)) !== "worktrees") return null
  const commonDir = path.dirname(path.dirname(gitdir))
  return path.basename(commonDir) === ".git" ? path.dirname(commonDir) : null
}

// True when `dir` is listed by `git worktree list` run in the trusted `mainDir`.
export async function isWorktreeOf(mainDir: string, dir: string): Promise<boolean> {
  return !!(await findWorktree(await listWorktrees(mainDir), dir))
}

function requireRef(value: string | undefined, what: string): string {
  const ref = (value || "").trim()
  if (!ref) throw new HttpError(400, `${what} is required`)
  if (ref.startsWith("-")) throw new HttpError(400, `Invalid ${what.toLowerCase()}: ${ref}`)
  return ref
}

// New worktrees must live next to the main worktree (inside its parent dir),
// matching the default path the UI suggests.
function requireWorktreePath(value: string | undefined, mainDir: string): string {
  const raw = (value || "").trim()
  if (!raw || !path.isAbsolute(raw)) throw new HttpError(400, "Worktree path must be absolute")
  const target = path.resolve(raw)
  const parent = path.dirname(path.resolve(mainDir))
  if (!allowAnyRepo() && !target.startsWith(parent + path.sep)) {
    throw new HttpError(400, `Worktree path must be inside ${parent}`)
  }
  return target
}

// Worktree commands run from the main worktree so removing the worktree the
// request came from doesn't pull the cwd out from under git.
async function mainOf(repo: string): Promise<{ mainDir: string; worktrees: Worktree[] }> {
  const worktrees = await listWorktrees(repo)
  const mainDir = worktrees[0]?.path
  if (!mainDir) throw new HttpError(400, "Not a git repository")
  return { mainDir, worktrees }
}

export async function addWorktree(repo: string, payload: ActionPayload): Promise<string> {
  const { mainDir } = await mainOf(repo)
  const branch = requireRef(payload.branch, "Branch")
  const target = requireWorktreePath(payload.path, mainDir)

  if (payload.newBranch) {
    try {
      await git(mainDir, ["check-ref-format", "--branch", branch])
    } catch {
      throw new HttpError(400, `Invalid branch name: ${branch}`)
    }
    const base = requireRef(payload.base || "HEAD", "Base")
    await git(mainDir, ["worktree", "add", "-b", branch, "--", target, base])
  } else {
    await git(mainDir, ["worktree", "add", "--", target, branch])
  }
  return `Created worktree ${target} (${branch})`
}

export async function removeWorktree(repo: string, payload: ActionPayload): Promise<string> {
  const { mainDir, worktrees } = await mainOf(repo)
  const target = (payload.path || "").trim()
  const worktree = target ? await findWorktree(worktrees, target) : undefined
  if (!worktree) throw new HttpError(400, `Not a worktree of this repository: ${target}`)
  if (worktree.main) throw new HttpError(400, "The main worktree can't be removed")

  if (worktree.prunable) {
    await git(mainDir, ["worktree", "prune"])
    return `Pruned missing worktree ${worktree.path}`
  }
  // A locked worktree needs --force twice.
  const force = payload.force ? (worktree.locked ? ["--force", "--force"] : ["--force"]) : []
  const r = await git(mainDir, ["worktree", "remove", ...force, "--", worktree.path])
  return output(r) || `Removed worktree ${worktree.path}`
}
