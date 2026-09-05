import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { readdir, readFile, stat } from "fs/promises"
import path from "path"

const execAsync = promisify(exec)

const DEFAULT_REPO = "/mnt/storage/Documents/Code/antikode/yamaha-golang-api"

// Global defaults used when ignore.config.json is missing or malformed.
const DEFAULT_IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  "vendor",
  "dist",
  "build",
  ".next",
  ".idea",
  "coverage",
  "tmp",
  "*.log",
  ".DS_Store",
]

type FileStatus = "tracked" | "untracked" | "ignored"
type EntryType = "file" | "dir"
type FileEntry = { path: string; status: FileStatus; type: EntryType }

// Collected during the walk: repo-relative paths of files and directories.
type WalkResult = { files: string[]; dirs: string[] }

/**
 * Load ignore patterns for a repo: global defaults from ignore.config.json
 * (or hardcoded fallback), unioned with the optional per-project "ignore"
 * array from the projects.json entry whose `dir` exactly matches `repo`.
 * Per-project entries only add patterns; they never remove global ones.
 */
async function loadIgnorePatterns(repo: string): Promise<string[]> {
  const patterns: string[] = []

  // Global config (ignore.config.json at the app root)
  try {
    const raw = await readFile(path.join(process.cwd(), "ignore.config.json"), "utf-8")
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === "string")) {
      patterns.push(...parsed)
    }
  } catch {
    // missing or malformed -> fall through to hardcoded defaults
  }
  if (patterns.length === 0) {
    patterns.push(...DEFAULT_IGNORE_PATTERNS)
  }

  // Per-project overrides (projects.json, matched by exact dir string)
  try {
    const raw = await readFile(path.join(process.cwd(), "projects.json"), "utf-8")
    const parsed: unknown = JSON.parse(raw)
    const projects = (parsed as { projects?: unknown } | null)?.projects
    if (Array.isArray(projects)) {
      const entry = projects.find(
        (p) =>
          p !== null &&
          typeof p === "object" &&
          typeof (p as { dir?: unknown }).dir === "string" &&
          (p as { dir: string }).dir === repo
      )
      const ignore = (entry as { ignore?: unknown } | undefined)?.ignore
      if (Array.isArray(ignore) && ignore.every((i) => typeof i === "string")) {
        patterns.push(...ignore)
      }
    }
  } catch {
    // missing/malformed projects.json or invalid ignore array -> globals only
  }

  return [...new Set(patterns)]
}

/**
 * Sublime-simple pattern matching (no glob dependency):
 * - Pattern without "/" matches any path segment equal to the pattern.
 *   A single trailing "*" is a suffix wildcard ("*.log" -> segment ends with ".log").
 * - Pattern with "/" (e.g. "storage/framework") matches when the pattern
 *   equals any cumulative relative-path prefix (an ancestor dir or the path itself).
 * Plain string comparison only — patterns are never regex-compiled or eval'd.
 */
function segmentMatches(pattern: string, segment: string): boolean {
  if (pattern.length > 1 && pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1)
    if (!prefix.includes("*")) {
      return segment.endsWith(prefix)
    }
  }
  return segment === pattern
}

function isIgnored(segments: string[], patterns: string[]): boolean {
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

async function gitLsFiles(cwd: string, args: string): Promise<Set<string>> {
  try {
    const { stdout } = await execAsync(`git ls-files ${args}`, {
      cwd,
      maxBuffer: 100 * 1024 * 1024,
    })
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const repo = searchParams.get("repo") || DEFAULT_REPO

  try {
    const patterns = await loadIgnorePatterns(repo)

    // Walk the filesystem and query git in parallel.
    const [walked, trackedSet, untrackedSet] = await Promise.all([
      (async () => {
        const result: WalkResult = { files: [], dirs: [] }
        await walkDir(repo, [], patterns, result)
        return result
      })(),
      gitLsFiles(repo, "--cached"),
      gitLsFiles(repo, "--others --exclude-standard"),
    ])

    const dirSets = dirStatuses(trackedSet, untrackedSet)

    const entries: FileEntry[] = [
      ...walked.dirs.map((d) => ({
        path: d,
        status: dirSets.tracked.has(d)
          ? ("tracked" as const)
          : dirSets.untracked.has(d)
            ? ("untracked" as const)
            : ("ignored" as const),
        type: "dir" as const,
      })),
      ...walked.files.map((p) => ({
        path: p,
        status: trackedSet.has(p)
          ? ("tracked" as const)
          : untrackedSet.has(p)
            ? ("untracked" as const)
            : ("ignored" as const),
        type: "file" as const,
      })),
    ]

    // Directories first, then files; alphabetical within each group.
    entries.sort((a, b) =>
      a.type === b.type ? a.path.localeCompare(b.path) : a.type === "dir" ? -1 : 1
    )

    return NextResponse.json({ files: entries })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list files" },
      { status: 500 }
    )
  }
}