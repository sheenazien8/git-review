import { existsSync, readFileSync } from "fs"
import path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createTempRepo, type TempRepo } from "../../../test/git-repo"
import { HttpError } from "../http"
import { actions } from "./actions"
import { getDiff } from "./diff"
import { getStatus, isUntracked } from "./status"

let repo: TempRepo

beforeEach(() => {
  repo = createTempRepo()
})
afterEach(() => repo.cleanup())

function commitAll(msg = "init") {
  repo.git("add", "-A")
  repo.git("commit", "-q", "-m", msg)
}

describe("getStatus", () => {
  it("reports branch, staged, unstaged and untracked files", async () => {
    repo.write("a.txt", "a\n")
    commitAll()
    repo.write("a.txt", "a2\n")
    repo.git("add", "a.txt")
    repo.write("a.txt", "a3\n")
    repo.write("dir/new.txt", "n\n")

    const { branch, files } = await getStatus(repo.dir)
    expect(branch).toBe("main")
    expect(files).toEqual([
      { path: "a.txt", status: "modified", staged: true, oldPath: undefined },
      { path: "a.txt", status: "modified", staged: false, oldPath: undefined },
      { path: "dir/new.txt", status: "untracked", staged: false },
    ])
    expect(await isUntracked(repo.dir, "dir/new.txt")).toBe(true)
    expect(await isUntracked(repo.dir, "a.txt")).toBe(false)
  })
})

describe("getDiff", () => {
  it("diffs untracked files against /dev/null", async () => {
    repo.write("a.txt", "a\n")
    commitAll()
    repo.write("u.txt", "hello\n")
    const diff = await getDiff(repo.dir, { file: "u.txt", side: "unstaged" })
    expect(diff).toContain("+hello")
  })

  it("separates staged and unstaged sides", async () => {
    repo.write("a.txt", "1\n")
    commitAll()
    repo.write("a.txt", "2\n")
    repo.git("add", "a.txt")
    repo.write("a.txt", "3\n")
    expect(await getDiff(repo.dir, { file: "a.txt", side: "staged" })).toMatch(/-1\n\+2/)
    expect(await getDiff(repo.dir, { file: "a.txt", side: "unstaged" })).toMatch(/-2\n\+3/)
    expect(await getDiff(repo.dir, { file: "a.txt", side: "head" })).toMatch(/-1\n\+3/)
  })

  it("diffs staged files against the empty tree when HEAD is unborn", async () => {
    repo.write("a.txt", "first\n")
    repo.git("add", "a.txt")
    expect(await getDiff(repo.dir, { file: "a.txt", side: "staged" })).toContain("+first")
  })

  it("keeps rename detection when given the old path", async () => {
    repo.write("old.txt", "same content\nline 2\nline 3\n")
    commitAll()
    repo.git("mv", "old.txt", "new.txt")
    const diff = await getDiff(repo.dir, { file: "new.txt", oldPath: "old.txt", side: "staged" })
    expect(diff).toContain("rename from old.txt")
    expect(diff).toContain("rename to new.txt")
  })

  it("does not interpret file names through a shell", async () => {
    repo.write("a.txt", "a\n")
    commitAll()
    const evil = `x"; touch pwned; echo "`
    await getDiff(repo.dir, { file: evil, side: "unstaged" }).catch(() => "")
    expect(existsSync(path.join(repo.dir, "pwned"))).toBe(false)
  })
})

describe("actions", () => {
  it("stages, unstages and commits", async () => {
    repo.write("a.txt", "a\n")
    commitAll()
    repo.write("a.txt", "b\n")

    expect(await actions.add(repo.dir, { files: ["a.txt"] })).toBe("Staged 1 file")
    expect((await getStatus(repo.dir)).files).toMatchObject([{ path: "a.txt", staged: true }])

    await actions.unstage(repo.dir, { files: ["a.txt"] })
    expect((await getStatus(repo.dir)).files).toMatchObject([{ path: "a.txt", staged: false }])

    await actions.addAll(repo.dir, {})
    await actions.commit(repo.dir, { message: "change" })
    expect((await getStatus(repo.dir)).files).toEqual([])
    expect(repo.git("log", "-1", "--format=%s").trim()).toBe("change")
  })

  it("unstages in a repo with no commits", async () => {
    repo.write("a.txt", "a\n")
    repo.git("add", "a.txt")
    await actions.unstage(repo.dir, { files: ["a.txt"] })
    expect((await getStatus(repo.dir)).files).toMatchObject([{ path: "a.txt", status: "untracked" }])

    repo.git("add", "a.txt")
    await actions.unstageAll(repo.dir, {})
    expect((await getStatus(repo.dir)).files).toMatchObject([{ path: "a.txt", status: "untracked" }])
  })

  it("validates input", async () => {
    await expect(actions.add(repo.dir, {})).rejects.toThrow("No file specified")
    await expect(actions.commit(repo.dir, { message: "  " })).rejects.toThrow("Commit message is required")
    await expect(actions.create(repo.dir, { path: "" })).rejects.toThrow("File path is required")
    await expect(actions.delete(repo.dir, { files: ["../outside"] })).rejects.toBeInstanceOf(HttpError)
    await expect(actions.discard(repo.dir, { files: ["/etc/passwd"] })).rejects.toBeInstanceOf(HttpError)
  })

  it("creates and deletes files", async () => {
    await actions.create(repo.dir, { path: "new.txt" })
    expect(readFileSync(path.join(repo.dir, "new.txt"), "utf-8")).toBe("")
    await expect(actions.create(repo.dir, { path: "new.txt" })).rejects.toMatchObject({ status: 409 })
    expect(await actions.delete(repo.dir, { files: ["new.txt"] })).toBe("Deleted 1 file")
    expect(existsSync(path.join(repo.dir, "new.txt"))).toBe(false)
  })

  it("discards tracked changes and removes untracked files", async () => {
    repo.write("a.txt", "a\n")
    commitAll()
    repo.write("a.txt", "changed\n")
    repo.write("u.txt", "u\n")
    await actions.discard(repo.dir, { files: ["a.txt", "u.txt"] })
    expect(readFileSync(path.join(repo.dir, "a.txt"), "utf-8")).toBe("a\n")
    expect(existsSync(path.join(repo.dir, "u.txt"))).toBe(false)
  })

  it("discards staged changes, deleting newly added files", async () => {
    repo.write("a.txt", "a\n")
    commitAll()
    repo.write("a.txt", "changed\n")
    repo.write("added.txt", "x\n")
    repo.git("add", "-A")
    expect(await actions.discardStaged(repo.dir, { files: ["a.txt", "added.txt"] })).toBe("Discarded 2 staged files")
    expect(readFileSync(path.join(repo.dir, "a.txt"), "utf-8")).toBe("a\n")
    expect(existsSync(path.join(repo.dir, "added.txt"))).toBe(false)
    expect((await getStatus(repo.dir)).files).toEqual([])
  })

  it("discards everything", async () => {
    repo.write("a.txt", "a\n")
    commitAll()
    repo.write("a.txt", "changed\n")
    repo.write("dir/u.txt", "u\n")
    await actions.discardAll(repo.dir, {})
    expect((await getStatus(repo.dir)).files).toEqual([])
  })
})
