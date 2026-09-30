import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { projects } from "./config"
import { HttpError } from "./http"
import { resolveInRepo, resolveRepo } from "./repo"

describe("resolveInRepo", () => {
  const repo = "/srv/repo"

  it("resolves paths inside the repo", () => {
    expect(resolveInRepo(repo, "src/a.ts")).toBe(path.join(repo, "src/a.ts"))
    expect(resolveInRepo(repo, "src/../b.ts")).toBe(path.join(repo, "b.ts"))
  })

  it.each(["../etc/passwd", "/etc/passwd", ".", "", "../repo2/x", "src/../../x"])("rejects %j", rel => {
    expect(() => resolveInRepo(repo, rel)).toThrow(HttpError)
  })
})

describe("resolveRepo", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("defaults to the first project", () => {
    expect(resolveRepo(null)).toBe(projects[0].dir)
  })

  it("accepts listed projects, including an equivalent spelling", () => {
    expect(resolveRepo(projects[0].dir + "/")).toBe(projects[0].dir + "/")
  })

  it("rejects unlisted repos with 403", () => {
    try {
      resolveRepo("/etc")
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError)
      expect((e as HttpError).status).toBe(403)
    }
  })

  it("allows any repo when GIT_REVIEW_ALLOW_ANY_REPO=1", () => {
    vi.stubEnv("GIT_REVIEW_ALLOW_ANY_REPO", "1")
    expect(resolveRepo("/etc")).toBe("/etc")
  })
})
