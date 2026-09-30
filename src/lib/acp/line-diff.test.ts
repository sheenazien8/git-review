import { describe, expect, it } from "vitest"
import { parseDiff } from "@/lib/git/parse-diff"
import { unifiedDiff } from "./line-diff"

describe("unifiedDiff", () => {
  it("is empty when nothing changed", () => {
    expect(unifiedDiff("a\nb\n", "a\nb\n")).toBe("")
  })

  it("diffs a new file against nothing", () => {
    expect(unifiedDiff(null, "a\nb\n")).toBe("@@ -0,0 +1,2 @@\n+a\n+b\n")
  })

  it("keeps 3 lines of context and numbers lines like git", () => {
    const old = ["1", "2", "3", "4", "5", "6", "7", "8"].join("\n")
    const next = ["1", "2", "3", "4", "X", "6", "7", "8"].join("\n")
    const diff = unifiedDiff(old, next)
    expect(diff.split("\n")[0]).toBe("@@ -2,7 +2,7 @@")
    const hunks = parseDiff(diff)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].lines.filter(l => l.type === "remove").map(l => l.content)).toEqual(["-5"])
    expect(hunks[0].lines.find(l => l.type === "add")?.newLineNo).toBe(5)
  })

  it("splits far-apart changes into separate hunks", () => {
    const old = Array.from({ length: 30 }, (_, i) => `l${i}`)
    const next = old.slice()
    next[2] = "a"
    next[25] = "b"
    expect(parseDiff(unifiedDiff(old.join("\n"), next.join("\n")))).toHaveLength(2)
  })

  it("handles deletions", () => {
    expect(unifiedDiff("a\nb\nc\n", "a\nc\n")).toBe("@@ -1,3 +1,2 @@\n a\n-b\n c\n")
  })
})
