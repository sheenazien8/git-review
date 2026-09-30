import { NextResponse } from "next/server"
import type { AcpActionRequest } from "@/lib/acp/types"
import { getSession, runAction } from "@/server/acp/registry"
import { readJson, withErrors } from "@/server/http"

export const POST = withErrors("Agent action failed", async req => {
  const { sessionId, ...action } = await readJson<AcpActionRequest>(req)
  await runAction(getSession(sessionId), action)
  return NextResponse.json({ success: true })
})
