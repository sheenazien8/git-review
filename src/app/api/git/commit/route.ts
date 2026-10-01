import { NextResponse } from "next/server"
import { getCommit } from "@/server/git/log"
import { requireParam, withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const GET = withErrors("Failed to load commit", async req => {
  const params = req.nextUrl.searchParams
  const repo = await resolveRepo(params.get("repo"))
  return NextResponse.json(await getCommit(repo, requireParam(params.get("sha"), "No commit specified")))
})
