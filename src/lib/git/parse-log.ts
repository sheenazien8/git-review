import type { Commit, CommitFile, FileStatus } from "./types"

// `git log --format=` string for parseLog: each record starts with an ASCII
// record separator (0x1e) and its fields are NUL-separated, so subjects and
// bodies can contain anything but NUL.
export const LOG_FORMAT = "--format=%x1e%H%x00%h%x00%an%x00%ae%x00%aI%x00%P%x00%s%x00%b"

export function parseLog(output: string): Commit[] {
  const commits: Commit[] = []
  for (const record of output.split("\x1e")) {
    const fields = record.split("\0")
    if (fields.length < 8) continue
    const [sha, shortSha, author, email, date, parents, subject, ...body] = fields
    commits.push({
      sha,
      shortSha,
      author,
      email,
      date,
      parents: parents.split(" ").filter(Boolean),
      subject,
      // `git log` separates records with a newline, which ends up after the body.
      body: body.join("\0").trim(),
    })
  }
  return commits
}

function commitFileStatus(code: string): FileStatus {
  switch (code[0]) {
    case "A": return "added"
    case "C": return "added"
    case "D": return "deleted"
    case "R": return "renamed"
    default: return "modified"
  }
}

// Parses `git diff --name-status -z`: "<status>\0<path>\0", with renames and
// copies ("R100", "C75") carrying two paths: "<status>\0<old>\0<new>\0".
export function parseNameStatus(output: string): CommitFile[] {
  const fields = output.split("\0")
  const files: CommitFile[] = []
  let i = 0
  while (i < fields.length) {
    const code = fields[i++]
    if (!code) continue
    if (code[0] === "R" || code[0] === "C") {
      const oldPath = fields[i++]
      const path = fields[i++]
      if (path === undefined) break
      files.push({ path, status: commitFileStatus(code), oldPath: code[0] === "R" ? oldPath : undefined })
    } else {
      const path = fields[i++]
      if (path === undefined) break
      files.push({ path, status: commitFileStatus(code) })
    }
  }
  return files
}
