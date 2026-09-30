import { describe, expect, it } from "vitest"
import { parseWorktrees } from "./parse-worktrees"

const z = (...records: string[][]) => records.map(r => r.join("\0") + "\0").join("\0")

describe("parseWorktrees", () => {
  it("parses main, linked, detached, locked and prunable worktrees", () => {
    const out = z(
      ["worktree /r/app", "HEAD aaa", "branch refs/heads/main"],
      ["worktree /r/app-feat", "HEAD bbb", "branch refs/heads/feat/x"],
      ["worktree /r/app-det", "HEAD ccc", "detached", "locked some reason"],
      ["worktree /r/gone", "HEAD ddd", "branch refs/heads/g", "prunable gitdir file points to non-existent location"],
    )
    expect(parseWorktrees(out)).toEqual([
      { path: "/r/app", head: "aaa", branch: "main", main: true, detached: false, bare: false, locked: false, prunable: false },
      { path: "/r/app-feat", head: "bbb", branch: "feat/x", main: false, detached: false, bare: false, locked: false, prunable: false },
      { path: "/r/app-det", head: "ccc", main: false, detached: true, bare: false, locked: true, prunable: false },
      { path: "/r/gone", head: "ddd", branch: "g", main: false, detached: false, bare: false, locked: false, prunable: true },
    ])
  })

  it("keeps spaces in paths and handles bare repos", () => {
    const out = z(["worktree /r/my repo.git", "bare"], ["worktree /r/with space", "HEAD eee", "branch refs/heads/b"])
    const [bare, linked] = parseWorktrees(out)
    expect(bare).toMatchObject({ path: "/r/my repo.git", bare: true, main: true })
    expect(linked).toMatchObject({ path: "/r/with space", branch: "b", main: false })
  })

  it("returns [] for empty output", () => {
    expect(parseWorktrees("")).toEqual([])
  })
})
