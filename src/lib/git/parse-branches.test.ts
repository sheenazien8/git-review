import { describe, expect, it } from "vitest"
import { parseBranches } from "./parse-branches"

describe("parseBranches", () => {
  it("parses local + remote refs and skips remote HEAD", () => {
    const line = (...f: string[]) => f.join("\0")
    const out = [
      line("refs/heads/main", "main", "*", "abc1234", "origin/main", "ahead 2, behind 1", "/repo", "2024-01-02T00:00:00Z", "Subject"),
      line("refs/heads/feat", "feat", " ", "def5678", "", "", "", "2024-01-01T00:00:00Z", ""),
      line("refs/remotes/origin/HEAD", "origin", " ", "abc1234", "", "", "", "", ""),
      line("refs/remotes/origin/main", "origin/main", " ", "abc1234", "", "", "", "2024-01-02T00:00:00Z", "Subject"),
      "",
    ].join("\n")
    const branches = parseBranches(out)
    expect(branches.map(b => b.name)).toEqual(["main", "feat", "origin/main"])
    expect(branches[0]).toMatchObject({ current: true, remote: false, upstream: "origin/main", ahead: 2, behind: 1, worktree: "/repo" })
    expect(branches[1]).toMatchObject({ current: false, upstream: undefined, ahead: 0, behind: 0, worktree: undefined })
    expect(branches[2]).toMatchObject({ remote: true })
  })
})
