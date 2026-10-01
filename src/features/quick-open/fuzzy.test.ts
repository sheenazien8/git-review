import { describe, expect, it } from "vitest"
import { fuzzyMatch, matchSegments, parseQuery, queryTerms, rankPaths } from "./fuzzy"

const paths = [
  "src/features/app/git-review-app.tsx",
  "src/features/app/app-header.tsx",
  "src/features/viewer/file-viewer.tsx",
  "src/features/viewer/diff-view.tsx",
  "src/features/find/find-bar.tsx",
  "src/lib/git/parse-diff.ts",
  "src/server/git/diff.ts",
  "docs/plan/25-quick-open-file-picker.md",
  "src/greater/random/archive.ts",
]

function top(query: string) {
  return rankPaths(paths, query)[0]?.path
}

describe("rankPaths", () => {
  it("matches word starts", () => {
    expect(top("gra")).toBe("src/features/app/git-review-app.tsx")
    expect(top("fv")).toBe("src/features/viewer/file-viewer.tsx")
  })

  it("prefers file-name matches over directory matches", () => {
    const ranked = rankPaths(["src/diff/index.ts", "src/lib/parse-diff.ts", "src/git/diff.ts"], "diff").map(r => r.path)
    expect(ranked).toEqual(["src/git/diff.ts", "src/lib/parse-diff.ts", "src/diff/index.ts"])
  })

  it("requires every space-separated term", () => {
    expect(rankPaths(paths, "viewer diff").map(r => r.path)).toEqual(["src/features/viewer/diff-view.tsx"])
  })

  it("is case-insensitive", () => {
    expect(top("APPHEADER")).toBe("src/features/app/app-header.tsx")
  })

  it("breaks ties by shorter path", () => {
    expect(rankPaths(["a/b/x.ts", "x.ts"], "x.ts").map(r => r.path)).toEqual(["x.ts", "a/b/x.ts"])
  })

  it("returns nothing for an empty query or no match", () => {
    expect(rankPaths(paths, "  ")).toEqual([])
    expect(rankPaths(paths, "zzz")).toEqual([])
  })

  it("respects the limit", () => {
    expect(rankPaths(paths, "s", 2)).toHaveLength(2)
  })

  it("ranks 20k paths quickly", () => {
    const many = Array.from({ length: 20000 }, (_, i) => `src/module-${i % 97}/sub-${i % 13}/file-${i}.tsx`)
    const t = performance.now()
    rankPaths(many, "mod sub fil")
    expect(performance.now() - t).toBeLessThan(500)
  })
})

describe("fuzzyMatch", () => {
  it("reports the matched positions", () => {
    expect(fuzzyMatch(queryTerms("ab"), "x/ab.ts")?.positions).toEqual([2, 3])
    expect(fuzzyMatch(queryTerms("ba"), "x/ab.ts")).toBeNull()
  })
})

describe("parseQuery", () => {
  it("splits a trailing line number", () => {
    expect(parseQuery("src/a.ts:42")).toEqual({ text: "src/a.ts", line: 42 })
    expect(parseQuery("a.ts:7:3")).toEqual({ text: "a.ts", line: 7 })
  })

  it("keeps other colons as text", () => {
    expect(parseQuery("a:b")).toEqual({ text: "a:b" })
    expect(parseQuery(" a.ts ")).toEqual({ text: "a.ts" })
    expect(parseQuery("a.ts:0")).toEqual({ text: "a.ts" })
  })
})

describe("matchSegments", () => {
  it("groups matched runs", () => {
    expect(matchSegments("abcd", [1, 2])).toEqual([
      { text: "a", match: false },
      { text: "bc", match: true },
      { text: "d", match: false },
    ])
    expect(matchSegments("x/ab", [2], 2)).toEqual([{ text: "a", match: true }, { text: "b", match: false }])
  })
})
