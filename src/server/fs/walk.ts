import "server-only"
import { readdir, stat } from "fs/promises"
import path from "path"
import type { RepoEntry, RepoEntryStatus } from "@/lib/git/types"
import { loadIgnorePatterns } from "../config"
import { git } from "../git/exec"

// Collected during the walk: repo-relative paths of files and directories.
type WalkResult = { files: string[]; dirs: string[] }

/**
 * Sublime-simple pattern matching (no glob dependency):
 * - Pattern without "/" matches any path segment equal to the pattern.
 *   A single leading "*" matches a suffix ("*.log" -> segment ends with ".log"),
 *   a single trailing "*" matches a prefix ("cache*" -> segment starts with "cache").
 * - Pattern with "/" (e.g. "storage/framework") matches when the pattern
 *   equals any cumulative relative-path prefix (an ancestor dir or the path itself).
 * Plain string comparison only — patterns are never regex-compiled or eval'd.
 */
function segmentMatches(pattern: string, segment: string): boolean {
  if (pattern.length > 1) {
    const rest = pattern.startsWith("*") ? pattern.slice(1) : pattern.endsWith("*") ? pattern.slice(0, -1) : null
    if (rest !== null && !rest.includes("*")) {
      return pattern.startsWith("*") ? segment.endsWith(rest) : segment.startsWith(rest)
    }
  }
  return segment === pattern
}

export function isIgnored(segments: string[], patterns: string[]): boolean {
  if (segments.length === 0) return false
  for (const pattern of patterns) {
    if (pattern.includes("/")) {
      // Relative-path prefix: check each cumulative prefix of the path.
      let prefix = segments[0]
      if (prefix === pattern) return true
      for (let i = 1; i < segments.length; i++) {
        prefix = `${prefix}/${segments[i]}`
        if (prefix === pattern) return true
      }
    } else {
      // Any path segment matches -> ignored (so dirs get pruned at any depth).
      for (const segment of segments) {
        if (segmentMatches(pattern, segment)) return true
      }
    }
  }
  return false
}

/**
 * Recursive filesystem walk. Ignored directories are pruned — never descended
 * into — and ignored files are skipped. Every non-ignored directory is
 * collected as an entry too (type "dir"). Symlinked directories are not
 * followed (avoids cycles and double-listing); symlinked files are collected
 * like regular files when not ignored.
 */
async function walkDir(
  dir: string,
  segments: string[],
  patterns: string[],
  out: WalkResult
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const entrySegments = [...segments, entry.name]
    if (entry.isDirectory()) {
      if (!isIgnored(entrySegments, patterns)) {
        out.dirs.push(entrySegments.join("/"))
        await walkDir(path.join(dir, entry.name), entrySegments, patterns, out)
      }
    } else if (entry.isSymbolicLink()) {
      // Don't follow symlinked dirs. Broken symlinks (stat throws) are skipped.
      let isDir = false
      try {
        isDir = (await stat(path.join(dir, entry.name))).isDirectory()
      } catch {
        continue
      }
      if (!isDir && !isIgnored(entrySegments, patterns)) {
        out.files.push(entrySegments.join("/"))
      }
    } else if (!isIgnored(entrySegments, patterns)) {
      out.files.push(entrySegments.join("/"))
    }
  }
}

async function gitLsFiles(repo: string, args: string[]): Promise<Set<string>> {
  try {
    const { stdout } = await git(repo, ["ls-files", ...args], { maxBuffer: 100 * 1024 * 1024 })
    return new Set(stdout.split("\n").filter(Boolean))
  } catch {
    // Not a git repo (or git failure) -> empty set; everything falls back to "ignored".
    return new Set()
  }
}

/**
 * Derive a status for each walked directory from git's file lists:
 * tracked (contains a tracked file) > untracked (contains an untracked
 * file) > ignored (contains only ignored/no git-known files).
 */
function dirStatuses(
  trackedFiles: Set<string>,
  untrackedFiles: Set<string>
): { tracked: Set<string>; untracked: Set<string> } {
  const tracked = new Set<string>()
  const untracked = new Set<string>()
  for (const file of trackedFiles) {
    const segments = file.split("/")
    for (let i = 1; i < segments.length; i++) {
      tracked.add(segments.slice(0, i).join("/"))
    }
  }
  for (const file of untrackedFiles) {
    const segments = file.split("/")
    for (let i = 1; i < segments.length; i++) {
      const dir = segments.slice(0, i).join("/")
      if (!tracked.has(dir)) {
        untracked.add(dir)
      }
    }
  }
  return { tracked, untracked }
}

// Every non-ignored file and directory in the repo, dirs first, then
// alphabetical within each group.
export async function listRepoEntries(repo: string): Promise<RepoEntry[]> {
  const patterns = await loadIgnorePatterns(repo)

  // Walk the filesystem and query git in parallel.
  const [walked, trackedSet, untrackedSet] = await Promise.all([
    (async () => {
      const result: WalkResult = { files: [], dirs: [] }
      await walkDir(repo, [], patterns, result)
      return result
    })(),
    gitLsFiles(repo, ["--cached"]),
    gitLsFiles(repo, ["--others", "--exclude-standard"]),
  ])

  const dirSets = dirStatuses(trackedSet, untrackedSet)
  const statusOf = (p: string, tracked: Set<string>, untracked: Set<string>): RepoEntryStatus =>
    tracked.has(p) ? "tracked" : untracked.has(p) ? "untracked" : "ignored"

  const entries: RepoEntry[] = [
    ...walked.dirs.map(d => ({ path: d, status: statusOf(d, dirSets.tracked, dirSets.untracked), type: "dir" as const })),
    ...walked.files.map(p => ({ path: p, status: statusOf(p, trackedSet, untrackedSet), type: "file" as const })),
  ]

  entries.sort((a, b) =>
    a.type === b.type ? a.path.localeCompare(b.path, undefined, { numeric: true }) : a.type === "dir" ? -1 : 1
  )
  return entries
}
