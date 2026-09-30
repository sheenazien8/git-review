// Shared API contract between the /api/git/* route handlers and the client.

export type FileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked"

// One side (staged or unstaged) of a changed file. A file with both staged
// and unstaged changes appears twice, once per side.
export interface GitFile {
  path: string
  status: FileStatus
  staged: boolean
  oldPath?: string
}

export interface StatusResponse {
  files: GitFile[]
  branch: string
}

// One entry of `git worktree list`. The first entry is always the main worktree.
export interface Worktree {
  path: string
  head: string
  // Short branch name; absent when detached (or bare).
  branch?: string
  main: boolean
  detached: boolean
  bare: boolean
  locked: boolean
  // The worktree's directory is gone; git will drop it on `worktree prune`.
  prunable: boolean
}

export interface WorktreesResponse {
  worktrees: Worktree[]
  // Local branch names, for the "add worktree" dialog.
  branches: string[]
}

export type RepoEntryStatus = "tracked" | "untracked" | "ignored"
export type RepoEntryType = "file" | "dir"

// A file or directory from the filesystem walk behind /api/git/all-files.
export interface RepoEntry {
  path: string
  status: RepoEntryStatus
  type: RepoEntryType
}

export interface AllFilesResponse {
  files: RepoEntry[]
}

// "staged" = index vs HEAD, "unstaged" = worktree vs index, "head" = worktree vs HEAD.
export type DiffSide = "staged" | "unstaged" | "head"

export interface DiffResponse {
  diff: string
}

export interface ContentResponse {
  content: string
}

export const ACTION_NAMES = [
  "add",
  "addAll",
  "unstage",
  "unstageAll",
  "commit",
  "push",
  "create",
  "delete",
  "discard",
  "discardAll",
  "discardStaged",
  "addWorktree",
  "removeWorktree",
] as const

export type ActionName = (typeof ACTION_NAMES)[number]

export interface ActionPayload {
  files?: string[]
  message?: string
  // Repo-relative file path, or the absolute worktree path for add/removeWorktree.
  path?: string
  // addWorktree: branch to check out, creating it from `base` when `newBranch`.
  branch?: string
  newBranch?: boolean
  base?: string
  // removeWorktree: remove even with uncommitted changes.
  force?: boolean
}

export interface ActionRequest extends ActionPayload {
  action: ActionName
  repo?: string
}

export interface ActionResponse {
  success: true
  message: string
}

export interface ErrorResponse {
  error: string
}
