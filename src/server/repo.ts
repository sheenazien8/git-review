import "server-only"
import path from "path"
import { allowAnyRepo, defaultRepo, findProject } from "./config"
import { isWorktreeOf, mainWorktreeOf } from "./git/worktree"
import { HttpError } from "./http"

// Resolves the `repo` request param to a repository directory. Only repos
// listed in projects.json — or linked worktrees of them — are allowed unless
// GIT_REVIEW_ALLOW_ANY_REPO=1.
export async function resolveRepo(param: string | null | undefined): Promise<string> {
  const repo = param || defaultRepo()
  if (!repo) throw new HttpError(400, "No repository specified")
  if (allowAnyRepo() || findProject(repo)) return repo

  const main = await mainWorktreeOf(repo)
  const project = main ? findProject(main) : undefined
  if (!project || !(await isWorktreeOf(project.dir, repo))) {
    throw new HttpError(403, `Repository is not in projects.json: ${repo}`)
  }
  return repo
}

// Resolves a repo-relative path to an absolute one, rejecting anything that
// escapes the repo root (`../`, absolute paths, the root itself).
export function resolveInRepo(repo: string, relPath: string): string {
  const repoRoot = path.resolve(repo)
  const resolved = path.resolve(repoRoot, relPath)
  if (!resolved.startsWith(repoRoot + path.sep)) {
    throw new HttpError(400, `Invalid file path: ${relPath}`)
  }
  return resolved
}
