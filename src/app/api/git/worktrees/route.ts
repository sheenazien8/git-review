import { NextResponse } from "next/server"
import { getWorktrees } from "@/server/git/worktree"
import { withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const GET = withErrors("Failed to list worktrees", async req => {
  const repo = await resolveRepo(req.nextUrl.searchParams.get("repo"))
  return NextResponse.json(await getWorktrees(repo))
})
