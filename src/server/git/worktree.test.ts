import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createTempRepo, type TempRepo } from "../../../test/git-repo"
import { HttpError } from "../http"
import { resolveRepo } from "../repo"
import { actions } from "./actions"
import { getWorktrees, listWorktrees, mainWorktreeOf } from "./worktree"

// Only the temp repo counts as a listed project.
const listed = vi.hoisted(() => ({ dir: "" }))
vi.mock("../config", async importOriginal => ({
  ...(await importOriginal<typeof import("../config")>()),
  findProject: (repo: string) =>
    path.resolve(repo) === path.resolve(listed.dir) ? { name: "tmp", dir: listed.dir } : undefined,
}))

let repo: TempRepo
let sibling: (name: string) => string

beforeEach(() => {
  repo = createTempRepo()
  repo.write("a.txt", "a\n")
  repo.git("add", "-A")
  repo.git("commit", "-q", "-m", "init")
  listed.dir = repo.dir
  sibling = name => path.join(path.dirname(repo.dir), `${path.basename(repo.dir)}-${name}`)
})
afterEach(() => {
  for (const w of repo.git("worktree", "list", "--porcelain").match(/^worktree .+$/gm) ?? []) {
    const dir = w.slice("worktree ".length)
    if (dir !== repo.dir) rmSync(dir, { recursive: true, force: true })
  }
  repo.cleanup()
})

const status = (e: unknown) => (e instanceof HttpError ? e.status : 0)

describe("worktree actions", () => {
  it("adds a worktree on a new branch and lists it with branches", async () => {
    const dir = sibling("feat")
    await actions.addWorktree(repo.dir, { path: dir, branch: "feat/x", newBranch: true })
    expect(existsSync(path.join(dir, "a.txt"))).toBe(true)

    const { worktrees, branches } = await getWorktrees(repo.dir)
    expect(worktrees.map(w => [w.branch, w.main])).toEqual([["main", true], ["feat/x", false]])
    expect(branches).toEqual(["feat/x", "main"])
    // Listing from inside the linked worktree gives the same main-first order.
    expect((await listWorktrees(dir))[0].main).toBe(true)
  })

  it("adds a worktree for an existing branch", async () => {
    repo.git("branch", "existing")
    await actions.addWorktree(repo.dir, { path: sibling("existing"), branch: "existing" })
    expect((await listWorktrees(repo.dir))[1].branch).toBe("existing")
  })

  // `path: true` stands for a valid sibling path.
  it.each([
    { path: "relative/dir", branch: "b", newBranch: true },
    { path: "/etc/evil", branch: "b", newBranch: true },
    { path: "", branch: "b", newBranch: true },
    { path: true, branch: "-b", newBranch: true },
    { path: true, branch: "bad..name", newBranch: true },
    { path: true, branch: "b", newBranch: true, base: "--orphan" },
  ])("rejects bad input %j with 400", async payload => {
    const p = { ...payload, path: typeof payload.path === "string" ? payload.path : sibling("x") }
    await expect(actions.addWorktree(repo.dir, p)).rejects.toSatisfy(e => status(e) === 400)
  })

  it("removes a worktree, requiring force when dirty, never the main one", async () => {
    const dir = sibling("rm")
    await actions.addWorktree(repo.dir, { path: dir, branch: "rm", newBranch: true })
    writeFileSync(path.join(dir, "a.txt"), "dirty\n")

    await expect(actions.removeWorktree(repo.dir, { path: dir })).rejects.toThrow()
    // Works when issued from inside the worktree being removed.
    await actions.removeWorktree(dir, { path: dir, force: true })
    expect(existsSync(dir)).toBe(false)

    await expect(actions.removeWorktree(repo.dir, { path: repo.dir })).rejects.toSatisfy(e => status(e) === 400)
    await expect(actions.removeWorktree(repo.dir, { path: "/etc" })).rejects.toSatisfy(e => status(e) === 400)
  })

  it("prunes a worktree whose directory is gone", async () => {
    const dir = sibling("gone")
    await actions.addWorktree(repo.dir, { path: dir, branch: "gone", newBranch: true })
    rmSync(dir, { recursive: true, force: true })
    expect((await listWorktrees(repo.dir))[1].prunable).toBe(true)
    await actions.removeWorktree(repo.dir, { path: dir })
    expect(await listWorktrees(repo.dir)).toHaveLength(1)
  })
})

describe("resolveRepo with worktrees", () => {
  it("accepts a linked worktree of a listed project", async () => {
    const dir = sibling("ok")
    await actions.addWorktree(repo.dir, { path: dir, branch: "ok", newBranch: true })
    expect(await mainWorktreeOf(dir)).toBe(repo.dir)
    expect(await resolveRepo(dir)).toBe(dir)
  })

  it("rejects a worktree of an unlisted repo and a forged .git file", async () => {
    const other = createTempRepo()
    const forged = mkdtempSync(path.join(os.tmpdir(), "git-review-forged-"))
    try {
      other.git("commit", "-q", "--allow-empty", "-m", "i")
      const dir = path.join(path.dirname(other.dir), `${path.basename(other.dir)}-wt`)
      other.git("worktree", "add", "-q", "-b", "w", dir)
      await expect(resolveRepo(dir)).rejects.toSatisfy(e => status(e) === 403)
      rmSync(dir, { recursive: true, force: true })

      // Claims to belong to the listed repo, but git doesn't know it.
      writeFileSync(path.join(forged, ".git"), `gitdir: ${repo.dir}/.git/worktrees/fake\n`)
      await expect(resolveRepo(forged)).rejects.toSatisfy(e => status(e) === 403)
    } finally {
      other.cleanup()
      rmSync(forged, { recursive: true, force: true })
    }
  })
})
