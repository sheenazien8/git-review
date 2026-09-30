import "server-only"
import path from "path"
import { readFile } from "fs/promises"
// Bundled at build time — the same copy the client's project selector uses,
// so the server's allowlist and the UI can never disagree.
import projectsFile from "../../projects.json"

export interface Project {
  name: string
  dir: string
  // Extra ignore patterns for the All Files walk (added to the global ones).
  ignore?: string[]
}

export const projects: Project[] = (projectsFile as { projects: Project[] }).projects

export function defaultRepo(): string {
  return projects[0]?.dir ?? ""
}

export function findProject(repo: string): Project | undefined {
  const resolved = path.resolve(repo)
  return projects.find(p => path.resolve(p.dir) === resolved)
}

// Escape hatch for opening repos that aren't listed in projects.json.
export function allowAnyRepo(): boolean {
  return process.env.GIT_REVIEW_ALLOW_ANY_REPO === "1"
}

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

/**
 * Ignore patterns for a repo: global defaults from ignore.config.json (or the
 * hardcoded fallback), unioned with the optional per-project "ignore" array
 * from projects.json. Per-project entries only add patterns; they never
 * remove global ones.
 */
export async function loadIgnorePatterns(repo: string): Promise<string[]> {
  const patterns: string[] = []

  try {
    const raw = await readFile(path.join(process.cwd(), "ignore.config.json"), "utf-8")
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(p => typeof p === "string")) {
      patterns.push(...parsed)
    }
  } catch {
    // missing or malformed -> fall through to hardcoded defaults
  }
  if (patterns.length === 0) {
    patterns.push(...DEFAULT_IGNORE_PATTERNS)
  }

  const ignore = findProject(repo)?.ignore
  if (Array.isArray(ignore) && ignore.every(i => typeof i === "string")) {
    patterns.push(...ignore)
  }

  return [...new Set(patterns)]
}
