import { NextResponse } from "next/server"
import { listRepoEntries } from "@/server/fs/walk"
import { withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const GET = withErrors("Failed to list files", async req => {
  const repo = resolveRepo(req.nextUrl.searchParams.get("repo"))
  return NextResponse.json({ files: await listRepoEntries(repo) })
})
