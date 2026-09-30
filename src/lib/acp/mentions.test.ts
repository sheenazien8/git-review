import { describe, expect, it } from "vitest"
import type { RepoEntry } from "@/lib/git/types"
import { extractMentions, insertMention, mentionableFiles, mentionAt, rankFiles, removeMention } from "./mentions"

describe("mentionableFiles", () => {
  const entry = (path: string, status: RepoEntry["status"], type: RepoEntry["type"] = "file"): RepoEntry => ({ path, status, type })

  it("drops git-ignored files and directories", () => {
    expect(mentionableFiles([
      entry("src", "tracked", "dir"),
      entry("src/a.ts", "tracked"),
      entry("new.ts", "untracked"),
      entry(".env.local", "ignored"),
      entry("projects.json", "ignored"),
    ])).toEqual(["src/a.ts", "new.ts"])
  })

  it("offers everything outside a git repo", () => {
    expect(mentionableFiles([entry("a.txt", "ignored"), entry("b.txt", "ignored")])).toEqual(["a.txt", "b.txt"])
  })
})

describe("mentionAt", () => {
  it("finds the mention being typed", () => {
    expect(mentionAt("@", 1)).toEqual({ start: 0, query: "" })
    expect(mentionAt("look at @src/a", 14)).toEqual({ start: 8, query: "src/a" })
  })

  it("ignores @ inside words and finished mentions", () => {
    expect(mentionAt("me@example.com", 14)).toBeNull()
    expect(mentionAt("@a.ts done", 10)).toBeNull()
  })
})

describe("rankFiles", () => {
  const files = ["src/app/page.tsx", "src/features/agent/agent-panel.tsx", "README.md", "docs/panel-notes.md"]

  it("prefers file-name prefixes, then substrings, then paths", () => {
    expect(rankFiles(files, "panel")).toEqual(["docs/panel-notes.md", "src/features/agent/agent-panel.tsx"])
    expect(rankFiles(files, "features")).toEqual(["src/features/agent/agent-panel.tsx"])
  })

  it("falls back to an in-order match and respects the limit", () => {
    expect(rankFiles(files, "sapt")).toContain("src/app/page.tsx")
    expect(rankFiles(files, "", 2)).toEqual(files.slice(0, 2))
  })
})

describe("insertMention", () => {
  it("replaces the typed query with the path and a space", () => {
    expect(insertMention("fix @pa please", 4, 7, "src/app/page.tsx")).toEqual({ text: "fix @src/app/page.tsx please", caret: 22 })
    expect(insertMention("@", 0, 1, "a.ts")).toEqual({ text: "@a.ts ", caret: 6 })
  })
})

describe("extractMentions", () => {
  const known = new Set(["a.ts", "src/b.ts"])

  it("keeps known files once, in order, ignoring trailing punctuation", () => {
    expect(extractMentions("see @src/b.ts, then @a.ts and @a.ts.", known)).toEqual(["src/b.ts", "a.ts"])
  })

  it("skips unknown paths and emails", () => {
    expect(extractMentions("@nope.ts me@a.ts", known)).toEqual([])
  })
})

describe("removeMention", () => {
  it("drops the mention and its trailing space", () => {
    expect(removeMention("fix @a.ts and @src/b.ts now", "a.ts")).toBe("fix and @src/b.ts now")
    expect(removeMention("@a.ts, ok", "a.ts")).toBe(", ok")
  })
})
