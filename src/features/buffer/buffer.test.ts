import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  type BufferState,
  TAB_CAP,
  bufferReducer,
  emptyBuffer,
  newEntry,
  readPersistedBuffer,
  writePersistedBuffer,
} from "./buffer"

const repo = "/repo"
const entry = (file: string, extra: Partial<ReturnType<typeof newEntry>> = {}) => ({
  ...newEntry(repo, { file, staged: false, fromAll: false }),
  ...extra,
})

function openAll(files: string[]): BufferState {
  return files.reduce((s, f) => bufferReducer(s, { type: "open", entry: entry(f) }), emptyBuffer)
}

describe("bufferReducer", () => {
  it("opens tabs once and activates them", () => {
    let s = openAll(["a", "b"])
    s = bufferReducer(s, { type: "open", entry: entry("a") })
    expect(s.entries.map(e => e.file)).toEqual(["a", "b"])
    expect(s.activeId).toBe(entry("a").id)
  })

  it("activates the right neighbour when closing the active tab", () => {
    let s = openAll(["a", "b", "c"])
    s = bufferReducer(s, { type: "activate", id: entry("b").id })
    s = bufferReducer(s, { type: "close", id: entry("b").id })
    expect(s.activeId).toBe(entry("c").id)
    s = bufferReducer(s, { type: "close", id: entry("c").id })
    expect(s.activeId).toBe(entry("a").id)
    s = bufferReducer(s, { type: "close", id: entry("a").id })
    expect(s).toEqual(emptyBuffer)
  })

  it("keeps the active tab when closing another", () => {
    const s = bufferReducer(openAll(["a", "b"]), { type: "close", id: entry("a").id })
    expect(s.activeId).toBe(entry("b").id)
  })

  it("evicts the oldest clean, inactive tab past the cap", () => {
    const files = Array.from({ length: TAB_CAP }, (_, i) => `f${i}`)
    let s = openAll(files)
    s = bufferReducer(s, { type: "update", id: entry("f0").id, patch: { dirty: true } })
    s = bufferReducer(s, { type: "open", entry: entry("new") })
    expect(s.entries).toHaveLength(TAB_CAP)
    expect(s.entries.map(e => e.file)).not.toContain("f1")
    expect(s.entries.map(e => e.file)).toContain("f0")
    expect(s.activeId).toBe(entry("new").id)
  })

  it("updates a single entry", () => {
    const s = bufferReducer(openAll(["a", "b"]), { type: "update", id: entry("a").id, patch: { diff: "x" } })
    expect(s.entries.map(e => e.diff)).toEqual(["x", ""])
  })
})

describe("persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    })
  })

  it("round-trips the tab list and active tab per repo", () => {
    const s = bufferReducer(openAll(["a", "b"]), { type: "activate", id: entry("a").id })
    writePersistedBuffer(repo, s)
    const restored = readPersistedBuffer(repo)
    expect(restored.entries.map(e => e.file)).toEqual(["a", "b"])
    expect(restored.activeId).toBe(entry("a").id)
    expect(readPersistedBuffer("/other")).toEqual(emptyBuffer)
  })

  it("falls back to the first tab when the stored active id is stale", () => {
    localStorage.setItem(`git-review-tabs-${btoa(repo)}`, JSON.stringify({ tabs: [{ file: "a", staged: false, fromAll: true }], activeId: "gone" }))
    expect(readPersistedBuffer(repo).activeId).toBe(newEntry(repo, { file: "a", staged: false, fromAll: true }).id)
  })

  it("ignores malformed data", () => {
    localStorage.setItem(`git-review-tabs-${btoa(repo)}`, "{nope")
    expect(readPersistedBuffer(repo)).toEqual(emptyBuffer)
  })
})
