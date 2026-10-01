import { NextResponse } from "next/server"
import { getBlame } from "@/server/git/blame"
import { requireParam, withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const GET = withErrors("Failed to load blame", async req => {
  const params = req.nextUrl.searchParams
  const repo = await resolveRepo(params.get("repo"))
  const file = requireParam(params.get("file"), "No file specified")
  return NextResponse.json(await getBlame(repo, file, params.get("ref") || undefined))
})
