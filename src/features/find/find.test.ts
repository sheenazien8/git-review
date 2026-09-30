import { describe, expect, it } from "vitest"
import {
  clipMatches,
  findMatches,
  highlightChunks,
  highlightHtmlWithMatches,
  highlightTextSegments,
  lineStartOffsets,
  splitLines,
} from "./find"

describe("findMatches", () => {
  it("finds literal, regex-safe matches", () => {
    expect(findMatches("a.b a.b axb", "a.b", true)).toEqual([{ start: 0, end: 3 }, { start: 4, end: 7 }])
  })

  it("respects case sensitivity", () => {
    expect(findMatches("Foo foo", "foo", false)).toHaveLength(2)
    expect(findMatches("Foo foo", "foo", true)).toEqual([{ start: 4, end: 7 }])
  })

  it("returns nothing for an empty query", () => {
    expect(findMatches("abc", "", false)).toEqual([])
  })
})

describe("line helpers", () => {
  it("splitLines drops the empty line after a trailing newline", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"])
    expect(splitLines("")).toEqual([""])
  })

  it("lineStartOffsets accounts for the joining newline", () => {
    expect(lineStartOffsets(["ab", "", "c"])).toEqual([0, 3, 4])
  })

  it("clipMatches rebases overlapping matches", () => {
    expect(clipMatches([{ start: 1, end: 5 }, { start: 8, end: 9 }], 3, 7)).toEqual([{ start: 0, end: 2 }])
  })
})

describe("highlightChunks", () => {
  it("numbers matches globally across lines and marks the active one", () => {
    const lines = ["foo bar", "bar foo foo"]
    const segments = highlightChunks(lines, findMatches(lines.join("\n"), "foo", false), 1)
    const marks = segments.map(line => line.filter(s => s.kind === "mark").map(s => [s.globalIndex, s.active]))
    expect(marks).toEqual([[[0, false]], [[1, true], [2, false]]])
  })

  it("matches the per-line highlightTextSegments output", () => {
    const text = "one two\nthree"
    const [first] = highlightChunks(["one two", "three"], findMatches(text, "o", false), 0)
    expect(first).toEqual(highlightTextSegments("one two", [{ start: 0, end: 1 }, { start: 6, end: 7 }], 0, 0).segments)
  })
})

describe("highlightHtmlWithMatches", () => {
  it("wraps matches across tags and keeps entities intact", () => {
    // Raw text: say "hi" — hljs escapes quotes as &quot;
    const html = '<span class="k">say</span> &quot;hi&quot;'
    const raw = 'say "hi"'
    const matches = findMatches(raw, '"hi"', false)
    const out = highlightHtmlWithMatches(html, matches, 0, 3)
    expect(out).toBe(
      '<span class="k">say</span> <mark class="bg-primary text-primary-foreground ring-1 ring-ring rounded-sm" data-find-match="3">&quot;hi&quot;</mark>'
    )
  })

  it("re-opens a mark that spans a tag boundary", () => {
    const out = highlightHtmlWithMatches("<b>ab</b>cd", [{ start: 1, end: 3 }], -1, 0)
    expect(out).toBe('<b>a<mark class="bg-primary/25 text-foreground rounded-sm">b</mark></b><mark class="bg-primary/25 text-foreground rounded-sm">c</mark>d')
  })

  it("returns the html unchanged without matches", () => {
    expect(highlightHtmlWithMatches("<i>x</i>", [], 0, 0)).toBe("<i>x</i>")
  })
})
