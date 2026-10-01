import { describe, expect, it } from "vitest"
import { parseBlame } from "./parse-blame"
import { UNCOMMITTED_SHA } from "./types"

const A = "a".repeat(40)

describe("parseBlame", () => {
  it("reads headers once per commit and a line per tab-prefixed content line", () => {
    const out = [
      `${A} 1 1 2`,
      "author Jane",
      "author-mail <jane@example.com>",
      "author-time 1700000000",
      "author-tz +0000",
      "summary First",
      "filename f.txt",
      "\tone",
      `${A} 2 2`,
      "\t\ttwo (tab-indented)",
      `${UNCOMMITTED_SHA} 3 3 1`,
      "author Not Committed Yet",
      "author-mail <not.committed.yet>",
      "author-time 1700000100",
      "summary Version of f.txt from f.txt",
      "filename f.txt",
      "\tthree",
      "",
    ].join("\n")
    const { lines, commits } = parseBlame(out)
    expect(lines).toEqual([
      { line: 1, sha: A, content: "one" },
      { line: 2, sha: A, content: "\ttwo (tab-indented)" },
      { line: 3, sha: UNCOMMITTED_SHA, content: "three" },
    ])
    expect(commits[A]).toEqual({
      sha: A,
      author: "Jane",
      email: "jane@example.com",
      date: "2023-11-14T22:13:20.000Z",
      summary: "First",
      uncommitted: false,
    })
    expect(commits[UNCOMMITTED_SHA].uncommitted).toBe(true)
  })
})
