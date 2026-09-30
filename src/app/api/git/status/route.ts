import { NextResponse } from "next/server"
import { getStatus } from "@/server/git/status"
import { withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const GET = withErrors("Failed to load git status", async req => {
  const repo = resolveRepo(req.nextUrl.searchParams.get("repo"))
  return NextResponse.json(await getStatus(repo))
})
