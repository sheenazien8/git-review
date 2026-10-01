import { NextResponse } from "next/server"
import { listBranches } from "@/server/git/branches"
import { withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const GET = withErrors("Failed to list branches", async req => {
  const repo = await resolveRepo(req.nextUrl.searchParams.get("repo"))
  return NextResponse.json(await listBranches(repo))
})
