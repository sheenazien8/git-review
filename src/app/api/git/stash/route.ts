import { NextResponse } from "next/server"
import { listStashes } from "@/server/git/stash"
import { withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const GET = withErrors("Failed to list stashes", async req => {
  const repo = await resolveRepo(req.nextUrl.searchParams.get("repo"))
  return NextResponse.json(await listStashes(repo))
})
