import { describe, expect, it } from "vitest"
import { parseLog, parseNameStatus } from "./parse-log"

const A = "a".repeat(40)
const B = "b".repeat(40)

describe("parseLog", () => {
  it("splits records on RS and fields on NUL, keeping multi-line bodies", () => {
    const rec = (sha: string, parents: string, subject: string, body: string) =>
      `\x1e${sha}\0${sha.slice(0, 7)}\0Jane\0j@e\x002024-01-01T00:00:00Z\0${parents}\0${subject}\0${body}\n`
    const out = rec(A, `${B} ${"c".repeat(40)}`, "Merge", "line 1\n\nline 3\n") + rec(B, "", "Root", "")
    const commits = parseLog(out)
    expect(commits).toHaveLength(2)
    expect(commits[0]).toMatchObject({ sha: A, shortSha: "aaaaaaa", parents: [B, "c".repeat(40)], subject: "Merge", body: "line 1\n\nline 3" })
    expect(commits[1]).toMatchObject({ sha: B, parents: [], subject: "Root", body: "" })
  })
})

describe("parseNameStatus", () => {
  it("handles renames, copies and plain changes", () => {
    const out = ["M", "a.txt", "R100", "old name.txt", "new name.txt", "C80", "src.txt", "copy.txt", "D", "gone.txt", "A", "new.txt", ""].join("\0")
    expect(parseNameStatus(out)).toEqual([
      { path: "a.txt", status: "modified" },
      { path: "new name.txt", status: "renamed", oldPath: "old name.txt" },
      { path: "copy.txt", status: "added", oldPath: undefined },
      { path: "gone.txt", status: "deleted" },
      { path: "new.txt", status: "added" },
    ])
  })
})
