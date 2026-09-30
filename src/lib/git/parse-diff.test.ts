import { describe, expect, it } from "vitest"
import { parseDiff } from "./parse-diff"

describe("parseDiff", () => {
  it("parses hunks with line numbers and ignores the trailing newline", () => {
    const raw = [
      "diff --git a/a.txt b/a.txt",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,3 +1,3 @@",
      " one",
      "-two",
      "+TWO",
      " three",
      "\\ No newline at end of file",
      "",
    ].join("\n")
    const hunks = parseDiff(raw)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].header).toBe("@@ -1,3 +1,3 @@")
    expect(hunks[0].lines).toEqual([
      { type: "context", content: " one", oldLineNo: 1, newLineNo: 1 },
      { type: "remove", content: "-two", oldLineNo: 2 },
      { type: "add", content: "+TWO", newLineNo: 2 },
      { type: "context", content: " three", oldLineNo: 3, newLineNo: 3 },
    ])
  })

  it("handles multiple hunks and single-line ranges", () => {
    const hunks = parseDiff("@@ -1 +1 @@\n-a\n+b\n@@ -10,2 +10,3 @@\n x\n+y\n z\n")
    expect(hunks).toHaveLength(2)
    expect(hunks[1].lines.map(l => l.newLineNo)).toEqual([10, 11, 12])
  })

  it("returns no hunks for empty or header-only output", () => {
    expect(parseDiff("")).toEqual([])
    expect(parseDiff("diff --git a/x b/y\nrename from x\nrename to y\n")).toEqual([])
  })
})
