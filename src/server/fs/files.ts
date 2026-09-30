import "server-only"
import { readFile, rm, writeFile } from "fs/promises"
import { HttpError } from "../http"
import { resolveInRepo } from "../repo"

export async function readRepoFile(repo: string, file: string): Promise<string> {
  return readFile(resolveInRepo(repo, file), "utf-8")
}

export async function writeRepoFile(repo: string, file: string, content: string): Promise<void> {
  await writeFile(resolveInRepo(repo, file), content, "utf-8")
}

// Creates an empty file; refuses to overwrite an existing one.
export async function createRepoFile(repo: string, file: string): Promise<void> {
  try {
    await writeFile(resolveInRepo(repo, file), "", { flag: "wx" })
  } catch (e) {
    if ((e as { code?: string }).code === "EEXIST") throw new HttpError(409, "File already exists")
    throw e
  }
}

// Removes files given as absolute paths (already validated by the caller).
export async function removeFiles(absPaths: string[]): Promise<void> {
  await Promise.all(absPaths.map(p => rm(p, { force: true })))
}
