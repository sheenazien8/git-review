// The buffer is the list of open tabs. Each entry holds everything the viewer
// needs for one (file, staged side, source) combination.

export const TAB_CAP = 20
const TABS_STORAGE_PREFIX = "git-review-tabs-"

export type ViewMode = "unified" | "split" | "raw"

// One open editor. The id is stable for the lifetime of the entry and is the
// only key used to look up / mutate / remove an entry from the buffer.
export interface BufferEntry {
  id: string
  file: string
  staged: boolean
  // Opened from the All Files tree: shows raw content instead of a diff.
  fromAll: boolean
  diff: string
  diffLoading: boolean
  raw: string
  rawError: string
  md: string
  mdRender: boolean
  viewMode: ViewMode
  editMode: boolean
  editContent: string
  // True when editContent has drifted away from the on-disk content.
  dirty: boolean
  // Optional rename hint from git status (oldPath → file).
  oldPath?: string
  // In-file find state, scoped to this tab.
  findOpen: boolean
  findQuery: string
  findCaseSensitive: boolean
  findMatchIndex: number
}

export interface TabKey {
  file: string
  staged: boolean
  fromAll: boolean
  oldPath?: string
}

// The repo path is part of the id so a stale id from another repo never
// resolves to a live entry.
export function makeTabId(repo: string, file: string, staged: boolean, fromAll: boolean) {
  return `${repo}::${file}::${staged ? "s" : "u"}::${fromAll ? "a" : "d"}`
}

export function newEntry(repo: string, { file, staged, fromAll, oldPath }: TabKey): BufferEntry {
  return {
    id: makeTabId(repo, file, staged, fromAll),
    file,
    staged,
    fromAll,
    diff: "",
    diffLoading: false,
    raw: "",
    rawError: "",
    md: "",
    mdRender: false,
    viewMode: "split",
    editMode: false,
    editContent: "",
    dirty: false,
    oldPath,
    findOpen: false,
    findQuery: "",
    findCaseSensitive: false,
    findMatchIndex: 0,
  }
}

// --- Reducer --------------------------------------------------------------

export interface BufferState {
  entries: BufferEntry[]
  activeId: string | null
}

export type BufferAction =
  | { type: "open"; entry: BufferEntry }
  | { type: "activate"; id: string }
  | { type: "close"; id: string }
  | { type: "update"; id: string; patch: Partial<BufferEntry> }
  | { type: "reset"; state: BufferState }

export const emptyBuffer: BufferState = { entries: [], activeId: null }

export function bufferReducer(state: BufferState, action: BufferAction): BufferState {
  switch (action.type) {
    case "open": {
      const { entry } = action
      if (state.entries.some(b => b.id === entry.id)) return { ...state, activeId: entry.id }
      let entries = [...state.entries, entry]
      // Soft cap: evict the oldest tab that isn't dirty, active, or the one
      // being opened. If every other tab is dirty, drop the oldest anyway to
      // keep the strip usable.
      if (entries.length > TAB_CAP) {
        const evictIdx = entries.findIndex(b => !b.dirty && b.id !== state.activeId && b.id !== entry.id)
        const dropAt = evictIdx === -1 ? 0 : evictIdx
        entries = [...entries.slice(0, dropAt), ...entries.slice(dropAt + 1)]
      }
      return { entries, activeId: entry.id }
    }

    case "activate":
      return state.activeId === action.id ? state : { ...state, activeId: action.id }

    case "close": {
      const removedIdx = state.entries.findIndex(b => b.id === action.id)
      const entries = state.entries.filter(b => b.id !== action.id)
      let activeId = state.activeId
      // Closing the active tab activates its right neighbour (or the new last tab).
      if (activeId === action.id) {
        activeId = removedIdx === -1 || entries.length === 0
          ? null
          : entries[Math.min(removedIdx, entries.length - 1)].id
      }
      return { entries, activeId }
    }

    case "update":
      return {
        ...state,
        entries: state.entries.map(b => (b.id === action.id ? { ...b, ...action.patch } : b)),
      }

    case "reset":
      return action.state
  }
}

// --- Persistence ----------------------------------------------------------
// Only the *list* of open tabs and the active one are persisted per repo;
// content is always re-fetched after a reload.

type PersistedTab = { file: string; staged: boolean; fromAll: boolean }
type PersistedBuffer = { tabs: PersistedTab[]; activeId: string | null }

function tabsStorageKey(repo: string) {
  // base64 of the repo path keeps weird characters out of the key.
  let b64 = ""
  try {
    b64 = btoa(repo)
  } catch {
    b64 = repo.replace(/[^a-zA-Z0-9_-]/g, "_")
  }
  return `${TABS_STORAGE_PREFIX}${b64}`
}

export function readPersistedBuffer(repo: string): BufferState {
  try {
    const raw = localStorage.getItem(tabsStorageKey(repo))
    if (!raw) return emptyBuffer
    const parsed = JSON.parse(raw) as PersistedBuffer
    if (!parsed || !Array.isArray(parsed.tabs)) return emptyBuffer
    const entries = parsed.tabs.map(t => newEntry(repo, t))
    const activeId = parsed.activeId && entries.some(b => b.id === parsed.activeId)
      ? parsed.activeId
      : entries[0]?.id ?? null
    return { entries, activeId }
  } catch {
    return emptyBuffer
  }
}

export function writePersistedBuffer(repo: string, { entries, activeId }: BufferState) {
  try {
    const payload: PersistedBuffer = {
      tabs: entries.map(b => ({ file: b.file, staged: b.staged, fromAll: b.fromAll })),
      activeId,
    }
    localStorage.setItem(tabsStorageKey(repo), JSON.stringify(payload))
  } catch {
    // localStorage may be unavailable / full — best-effort.
  }
}
