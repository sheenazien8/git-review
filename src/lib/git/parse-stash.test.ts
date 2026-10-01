import { describe, expect, it } from "vitest"
import { parseStash } from "./parse-stash"

const A = "a".repeat(40)
const B = "b".repeat(40)

describe("parseStash", () => {
  it("parses index, branch and message", () => {
    const out = `stash@{0}\0${A}\0WIP on main: abc123 Subject: with colon\x002024-01-01T00:00:00Z\nstash@{1}\0${B}\0On feat/x: my msg\x002024-01-01T00:00:00Z\n`
    expect(parseStash(out)).toEqual([
      { index: 0, sha: A, message: "WIP on main: abc123 Subject: with colon", branch: "main", date: "2024-01-01T00:00:00Z" },
      { index: 1, sha: B, message: "On feat/x: my msg", branch: "feat/x", date: "2024-01-01T00:00:00Z" },
    ])
  })
})
