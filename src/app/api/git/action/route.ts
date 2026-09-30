import { NextResponse } from "next/server"
import type { ActionRequest } from "@/lib/git/types"
import { actions } from "@/server/git/actions"
import { HttpError, readJson, withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const POST = withErrors("Git action failed", async req => {
  const body = await readJson<ActionRequest>(req)
  const handler = Object.hasOwn(actions, body.action) ? actions[body.action] : undefined
  if (!handler) throw new HttpError(400, `Unknown action: ${body.action}`)
  const repo = resolveRepo(body.repo)
  const message = await handler(repo, body)
  return NextResponse.json({ success: true, message })
})
