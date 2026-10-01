import { describe, expect, it } from "vitest"
import { countConflicts, joinSegments, parseConflicts, resolveConflict } from "./parse-conflict"

const merge = [
  "top\n",
  "<<<<<<< HEAD\n",
  "ours 1\n",
  "ours 2\n",
  "=======\n",
  "theirs\n",
  ">>>>>>> feature\n",
  "middle\n",
  "<<<<<<< HEAD\n",
  "o\n",
  "||||||| base\n",
  "b\n",
  "=======\n",
  ">>>>>>> feature\n",
  "end",
].join("")

describe("parseConflicts", () => {
  it("splits text and conflict blocks, with diff3 base and labels", () => {
    const segments = parseConflicts(merge)
    expect(segments.map(s => s.type)).toEqual(["text", "conflict", "text", "conflict", "text"])
    expect(segments[1]).toMatchObject({ ours: "ours 1\nours 2\n", theirs: "theirs\n", base: undefined, oursLabel: "HEAD", theirsLabel: "feature" })
    expect(segments[3]).toMatchObject({ ours: "o\n", base: "b\n", baseLabel: "base", theirs: "" })
    expect(countConflicts(segments)).toBe(2)
  })

  it("round-trips the file exactly", () => {
    expect(joinSegments(parseConflicts(merge))).toBe(merge)
    const crlf = "a\r\n<<<<<<< HEAD\r\nx\r\n=======\r\ny\r\n>>>>>>> t\r\n"
    const segments = parseConflicts(crlf)
    expect(countConflicts(segments)).toBe(1)
    expect(joinSegments(segments)).toBe(crlf)
  })

  it("treats an unterminated block as text", () => {
    const text = "<<<<<<< HEAD\nx\n=======\ny\n"
    expect(parseConflicts(text)).toEqual([{ type: "text", text }])
  })

  it("ignores marker-like lines that aren't markers", () => {
    expect(countConflicts(parseConflicts("<<<<<<<< eight\n=======x\n"))).toBe(0)
  })
})

describe("resolveConflict", () => {
  it("replaces only the chosen block", () => {
    expect(resolveConflict(merge, 0, "ours")).toBe(merge.replace("<<<<<<< HEAD\nours 1\nours 2\n=======\ntheirs\n>>>>>>> feature\n", "ours 1\nours 2\n"))
    const theirs = resolveConflict(merge, 1, "theirs")
    expect(theirs.endsWith("middle\nend")).toBe(true)
    expect(countConflicts(parseConflicts(theirs))).toBe(1)
  })

  it("accepts both sides, ours first", () => {
    const both = resolveConflict("<<<<<<< a\nx\n=======\ny\n>>>>>>> b\n", 0, "both")
    expect(both).toBe("x\ny\n")
  })
})
