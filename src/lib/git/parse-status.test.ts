import { describe, expect, it } from "vitest"
import { parseStatus } from "./parse-status"

describe("parseStatus", () => {
  it("splits files with staged and unstaged changes into two entries", () => {
    expect(parseStatus("MM src/a.ts\n")).toEqual([
      { path: "src/a.ts", status: "modified", staged: true, oldPath: undefined },
      { path: "src/a.ts", status: "modified", staged: false, oldPath: undefined },
    ])
  })

  it("maps index and worktree codes", () => {
    const files = parseStatus("A  new.ts\nD  gone.ts\n D wt-gone.ts\n M wt.ts\nC  copy.ts\n?? untracked.ts\n")
    expect(files.map(f => [f.path, f.status, f.staged])).toEqual([
      ["new.ts", "added", true],
      ["gone.ts", "deleted", true],
      ["wt-gone.ts", "deleted", false],
      ["wt.ts", "modified", false],
      ["copy.ts", "added", true],
      ["untracked.ts", "untracked", false],
    ])
  })

  it("keeps the rename source only on the side that carries the rename", () => {
    expect(parseStatus("RM old.ts -> new.ts\n")).toEqual([
      { path: "new.ts", status: "renamed", staged: true, oldPath: "old.ts" },
      { path: "new.ts", status: "modified", staged: false, oldPath: undefined },
    ])
  })

  it("ignores blank lines", () => {
    expect(parseStatus("")).toEqual([])
  })
})

describe("parseStatus conflicts", () => {
  it("reports unmerged paths once, as conflicted and unstaged", () => {
    expect(parseStatus("UU both.txt\nAA added.txt\nDU deleted-by-us.txt\nM  staged.txt\n")).toEqual([
      { path: "both.txt", status: "conflicted", staged: false },
      { path: "added.txt", status: "conflicted", staged: false },
      { path: "deleted-by-us.txt", status: "conflicted", staged: false },
      { path: "staged.txt", status: "modified", staged: true, oldPath: undefined },
    ])
  })
})
