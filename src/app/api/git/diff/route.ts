import { NextResponse } from "next/server"
import type { DiffSide } from "@/lib/git/types"
import { getDiff } from "@/server/git/diff"
import { requireParam, withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

// "0" = unstaged side, "1" = staged side; absent = legacy (diff vs HEAD)
function sideFromParam(staged: string | null): DiffSide {
  return staged === "1" ? "staged" : staged === "0" ? "unstaged" : "head"
}

export const GET = withErrors("Failed to load diff", async req => {
  const params = req.nextUrl.searchParams
  const repo = resolveRepo(params.get("repo"))
  const file = requireParam(params.get("file"), "No file specified")
  // Source path when `file` is a rename target.
  const oldPath = params.get("oldPath") || undefined
  const diff = await getDiff(repo, { file, oldPath, side: sideFromParam(params.get("staged")) })
  return NextResponse.json({ diff })
})
