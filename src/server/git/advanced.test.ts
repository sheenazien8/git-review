import { readFileSync } from "fs"
import path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createTempRepo, type TempRepo } from "../../../test/git-repo"
import { HttpError } from "../http"
import { actions } from "./actions"
import { getBlame } from "./blame"
import { listBranches } from "./branches"
import { getDiff } from "./diff"
import { getCommit, getCommitDiff, getLog } from "./log"
import { listStashes } from "./stash"
import { getStatus } from "./status"

let repo: TempRepo

beforeEach(() => {
  repo = createTempRepo()
})
afterEach(() => repo.cleanup())

function commitAll(msg: string) {
  repo.git("add", "-A")
  repo.git("commit", "-q", "-m", msg)
  return repo.git("rev-parse", "HEAD").trim()
}

const read = (file: string) => readFileSync(path.join(repo.dir, file), "utf-8")

async function expectHttpError(p: Promise<unknown>, status: number) {
  await expect(p).rejects.toBeInstanceOf(HttpError)
  await p.catch(e => expect((e as HttpError).status).toBe(status))
}

describe("getLog", () => {
  it("is empty before the first commit", async () => {
    expect(await getLog(repo.dir, { limit: 10, skip: 0 })).toEqual({ commits: [], hasMore: false })
  })

  it("pages newest-first and filters by file, following renames", async () => {
    repo.write("a.txt", "1\n")
    const first = commitAll("first")
    repo.write("b.txt", "b\n")
    commitAll("second\n\nwith a body")
    repo.git("mv", "a.txt", "renamed.txt")
    commitAll("rename a")

    const page1 = await getLog(repo.dir, { limit: 2, skip: 0 })
    expect(page1.commits.map(c => c.subject)).toEqual(["rename a", "second"])
    expect(page1.commits[1].body).toBe("with a body")
    expect(page1.hasMore).toBe(true)
    const page2 = await getLog(repo.dir, { limit: 2, skip: 2 })
    expect(page2.commits.map(c => c.sha)).toEqual([first])
    expect(page2.hasMore).toBe(false)

    const fileLog = await getLog(repo.dir, { file: "renamed.txt", limit: 10, skip: 0 })
    expect(fileLog.commits.map(c => c.subject)).toEqual(["rename a", "first"])
  })

  it("rejects paths outside the repo", async () => {
    await expectHttpError(getLog(repo.dir, { file: "../x", limit: 1, skip: 0 }), 400)
  })
})

describe("getCommit / getCommitDiff", () => {
  it("lists a root commit's files against the empty tree", async () => {
    repo.write("a.txt", "1\n")
    const sha = commitAll("root")
    const { commit, files } = await getCommit(repo.dir, sha)
    expect(commit.subject).toBe("root")
    expect(files).toEqual([{ path: "a.txt", status: "added" }])
    expect(await getCommitDiff(repo.dir, sha, { file: "a.txt" })).toContain("+1")
  })

  it("reports renames and per-file diffs against the first parent", async () => {
    repo.write("a.txt", "1\n2\n3\n4\n5\n")
    commitAll("root")
    repo.git("mv", "a.txt", "b.txt")
    repo.write("b.txt", "1\n2\n3\n4\n5\n6\n")
    const sha = commitAll("rename + edit")
    const { files } = await getCommit(repo.dir, sha)
    expect(files).toEqual([{ path: "b.txt", status: "renamed", oldPath: "a.txt" }])
    const diff = await getCommitDiff(repo.dir, sha, { file: "b.txt", oldPath: "a.txt" })
    expect(diff).toContain("rename from a.txt")
    expect(diff).toContain("+6")
  })

  it("validates the sha", async () => {
    await expectHttpError(getCommit(repo.dir, "HEAD~1"), 400)
    await expectHttpError(getCommit(repo.dir, "--output=/tmp/x"), 400)
    repo.write("a.txt", "1\n")
    commitAll("root")
    await expectHttpError(getCommit(repo.dir, "deadbeef"), 404)
  })
})

describe("getBlame", () => {
  it("attributes lines to commits, and uncommitted lines to the zero sha", async () => {
    repo.write("a.txt", "one\ntwo\n")
    const sha = commitAll("root")
    repo.write("a.txt", "one\nTWO\nthree\n")
    const { lines, commits } = await getBlame(repo.dir, "a.txt")
    expect(lines.map(l => l.content)).toEqual(["one", "TWO", "three"])
    expect(lines[0].sha).toBe(sha)
    expect(commits[sha]).toMatchObject({ author: "test", summary: "root", uncommitted: false })
    expect(commits[lines[1].sha].uncommitted).toBe(true)

    const atRoot = await getBlame(repo.dir, "a.txt", sha)
    expect(atRoot.lines.map(l => l.content)).toEqual(["one", "two"])
  })

  it("rejects ref expressions", async () => {
    repo.write("a.txt", "1\n")
    commitAll("root")
    await expectHttpError(getBlame(repo.dir, "a.txt", "HEAD"), 400)
  })
})

describe("branches", () => {
  beforeEach(() => {
    repo.write("a.txt", "1\n")
    commitAll("root")
  })

  it("lists, creates and deletes branches", async () => {
    expect(await actions.createBranch(repo.dir, { branch: "feat/x" })).toBe("Created branch feat/x")
    const { current, branches } = await listBranches(repo.dir)
    expect(current).toBe("main")
    expect(branches.map(b => [b.name, b.current])).toEqual(expect.arrayContaining([["main", true], ["feat/x", false]]))
    expect(await actions.deleteBranch(repo.dir, { branch: "feat/x" })).toMatch(/Deleted branch feat\/x/)
    expect((await listBranches(repo.dir)).branches.map(b => b.name)).toEqual(["main"])
  })

  it("creates and checks out a branch", async () => {
    await actions.createBranch(repo.dir, { branch: "new", checkout: true })
    expect((await getStatus(repo.dir)).branch).toBe("new")
  })

  it("rejects bad names", async () => {
    await expectHttpError(actions.createBranch(repo.dir, { branch: "a..b" }), 400)
    await expectHttpError(actions.createBranch(repo.dir, { branch: "-d" }), 400)
    await expectHttpError(actions.switchBranch(repo.dir, { branch: "nope" }), 400)
    await expectHttpError(actions.deleteBranch(repo.dir, { branch: "nope" }), 400)
  })

  it("refuses to switch with uncommitted changes unless asked to stash", async () => {
    repo.git("branch", "other")
    repo.write("a.txt", "dirty\n")
    await expectHttpError(actions.switchBranch(repo.dir, { branch: "other" }), 409)
    expect((await getStatus(repo.dir)).branch).toBe("main")

    expect(await actions.switchBranch(repo.dir, { branch: "other", stash: true })).toBe("Switched to other (changes stashed)")
    expect((await getStatus(repo.dir)).branch).toBe("other")
    expect(read("a.txt")).toBe("1\n")
    expect((await listStashes(repo.dir)).stashes).toHaveLength(1)
  })

  it("switches with only untracked files around", async () => {
    repo.git("branch", "other")
    repo.write("untracked.txt", "u\n")
    await actions.switchBranch(repo.dir, { branch: "other" })
    expect((await getStatus(repo.dir)).branch).toBe("other")
  })

  it("switches to a remote branch by creating a tracking branch", async () => {
    repo.git("remote", "add", "origin", repo.dir)
    repo.git("update-ref", "refs/remotes/origin/feature", "HEAD")
    expect(await actions.switchBranch(repo.dir, { branch: "origin/feature" })).toBe("Switched to feature")
    const feature = (await listBranches(repo.dir)).branches.find(b => b.name === "feature")
    expect(feature).toMatchObject({ current: true, upstream: "origin/feature" })
  })
})

describe("stash", () => {
  beforeEach(() => {
    repo.write("a.txt", "1\n")
    commitAll("root")
  })

  it("pushes, lists, applies, pops and drops", async () => {
    await expectHttpError(actions.stash(repo.dir, {}), 400)

    repo.write("a.txt", "2\n")
    repo.write("u.txt", "u\n")
    await actions.stash(repo.dir, { message: "first", includeUntracked: true })
    expect(read("a.txt")).toBe("1\n")
    repo.write("a.txt", "3\n")
    await actions.stash(repo.dir, {})

    const { stashes } = await listStashes(repo.dir)
    expect(stashes.map(s => [s.index, s.branch])).toEqual([[0, "main"], [1, "main"]])
    expect(stashes[1].message).toBe("On main: first")

    // A stash is a commit: its tracked changes show up as the commit's diff.
    const { files } = await getCommit(repo.dir, stashes[1].sha)
    expect(files).toEqual([{ path: "a.txt", status: "modified" }])

    await actions.stashApply(repo.dir, { index: 0 })
    expect(read("a.txt")).toBe("3\n")
    repo.git("checkout", "--", "a.txt")
    await actions.stashDrop(repo.dir, { index: 0 })
    await actions.stashPop(repo.dir, { index: 0 })
    expect(read("a.txt")).toBe("2\n")
    expect(read("u.txt")).toBe("u\n")
    expect((await listStashes(repo.dir)).stashes).toEqual([])
  })

  it("validates the index", async () => {
    await expectHttpError(actions.stashPop(repo.dir, {}), 400)
    await expectHttpError(actions.stashDrop(repo.dir, { index: -1 }), 400)
    await expectHttpError(actions.stashApply(repo.dir, { index: 1.5 }), 400)
  })
})

describe("merge conflicts", () => {
  it("shows conflicted files, a combined diff, and resolves with add", async () => {
    repo.write("a.txt", "base\n")
    commitAll("root")
    repo.git("switch", "-q", "-c", "feature")
    repo.write("a.txt", "theirs\n")
    commitAll("feature")
    repo.git("switch", "-q", "main")
    repo.write("a.txt", "ours\n")
    commitAll("main")
    try {
      repo.git("merge", "feature")
    } catch {
      // conflict: exits 1
    }

    expect((await getStatus(repo.dir)).files).toEqual([{ path: "a.txt", status: "conflicted", staged: false }])
    expect(await getDiff(repo.dir, { file: "a.txt", side: "unstaged" })).toMatch(/^diff --cc a\.txt/)
    expect(read("a.txt")).toContain("<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feature\n")

    repo.write("a.txt", "resolved\n")
    await actions.add(repo.dir, { files: ["a.txt"] })
    expect((await getStatus(repo.dir)).files).toEqual([{ path: "a.txt", status: "modified", staged: true, oldPath: undefined }])
  })
})
