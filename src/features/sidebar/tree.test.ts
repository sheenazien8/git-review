import { describe, expect, it } from "vitest"
import { ancestorDirs, buildTree, collectFilePaths, filterTreeNodes } from "./tree"

const entries = [
  { path: "src", status: "tracked", type: "dir" },
  { path: "src/b.ts", status: "tracked", type: "file" },
  { path: "src/a10.ts", status: "tracked", type: "file" },
  { path: "src/a2.ts", status: "untracked", type: "file" },
  { path: "README.md", status: "tracked", type: "file" },
  { path: "lib/deep/x.ts", status: "modified" },
]

describe("buildTree", () => {
  it("nests, creates implicit dirs, and sorts dirs first with numeric order", () => {
    const tree = buildTree(entries)
    expect(tree.map(n => n.path)).toEqual(["lib", "src", "README.md"])
    expect(tree[1].status).toBe("tracked")
    expect(tree[1].children.map(n => n.name)).toEqual(["a2.ts", "a10.ts", "b.ts"])
    expect(tree[0].children[0].children[0].path).toBe("lib/deep/x.ts")
  })
})

describe("filterTreeNodes", () => {
  it("keeps matching files with their ancestor dirs", () => {
    const tree = filterTreeNodes(buildTree(entries), "X.TS")
    expect(tree.map(n => n.path)).toEqual(["lib"])
    expect(collectFilePaths(tree[0])).toEqual(["lib/deep/x.ts"])
  })

  it("keeps a matching dir without its children", () => {
    expect(filterTreeNodes(buildTree(entries), "deep")[0].children[0]).toMatchObject({ path: "lib/deep" })
    expect(filterTreeNodes(buildTree(entries), "nope")).toEqual([])
  })

  it("returns the input for a blank query", () => {
    const tree = buildTree(entries)
    expect(filterTreeNodes(tree, "  ")).toBe(tree)
  })
})

describe("ancestorDirs", () => {
  it("lists every ancestor directory", () => {
    expect(ancestorDirs("a/b/c.ts")).toEqual(["a", "a/b"])
    expect(ancestorDirs("c.ts")).toEqual([])
  })
})
