import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createTempRepo, type TempRepo } from "../../../test/git-repo"
import { isIgnored, listRepoEntries } from "./walk"

describe("isIgnored", () => {
  it("matches bare names against any segment", () => {
    expect(isIgnored(["a", "node_modules", "x.js"], ["node_modules"])).toBe(true)
    expect(isIgnored(["src", "node_modules_x"], ["node_modules"])).toBe(false)
  })

  it("supports a trailing * suffix wildcard", () => {
    expect(isIgnored(["logs", "app.log"], ["*.log"])).toBe(true)
    expect(isIgnored(["app.logs"], ["*.log"])).toBe(false)
    expect(isIgnored(["cache-v2", "x"], ["cache*"])).toBe(true)
    expect(isIgnored(["my-cache"], ["cache*"])).toBe(false)
  })

  it("matches slash patterns as path prefixes", () => {
    expect(isIgnored(["storage", "framework", "cache"], ["storage/framework"])).toBe(true)
    expect(isIgnored(["app", "storage", "framework"], ["storage/framework"])).toBe(false)
  })
})

describe("listRepoEntries", () => {
  let repo: TempRepo
  beforeEach(() => {
    repo = createTempRepo()
  })
  afterEach(() => repo.cleanup())

  it("lists dirs first with tracked/untracked/ignored status", async () => {
    repo.write("src/a.ts", "a")
    repo.git("add", "-A")
    repo.git("commit", "-q", "-m", "init")
    repo.write("src/b.ts", "b")
    repo.write("new/c.ts", "c")
    repo.write(".gitignore", "secret.txt\n")
    repo.write("secret.txt", "s")
    repo.write("node_modules/x/index.js", "x")
    repo.write("debug.log", "l")

    expect(await listRepoEntries(repo.dir)).toEqual([
      { path: "new", status: "untracked", type: "dir" },
      { path: "src", status: "tracked", type: "dir" },
      { path: ".gitignore", status: "untracked", type: "file" },
      { path: "new/c.ts", status: "untracked", type: "file" },
      { path: "secret.txt", status: "ignored", type: "file" },
      { path: "src/a.ts", status: "tracked", type: "file" },
      { path: "src/b.ts", status: "untracked", type: "file" },
    ])
  })
})
