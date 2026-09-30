import { NextResponse } from "next/server"
import { readRepoFile, writeRepoFile } from "@/server/fs/files"
import { readJson, requireParam, withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const GET = withErrors("Failed to read file", async req => {
  const params = req.nextUrl.searchParams
  const repo = await resolveRepo(params.get("repo"))
  const file = requireParam(params.get("file"), "No file specified")
  return NextResponse.json({ content: await readRepoFile(repo, file) })
})

export const PUT = withErrors("Failed to write file", async req => {
  const params = req.nextUrl.searchParams
  const repo = await resolveRepo(params.get("repo"))
  const file = requireParam(params.get("file"), "No file specified")
  const body = await readJson<{ content?: string }>(req)
  await writeRepoFile(repo, file, body.content ?? "")
  return NextResponse.json({ success: true })
})
