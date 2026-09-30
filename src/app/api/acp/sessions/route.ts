import { NextResponse } from "next/server"
import type { OpenSessionRequest, OpenSessionResponse, SessionsResponse } from "@/lib/acp/types"
import { listLiveSessions, listPastSessions, openSession } from "@/server/acp/registry"
import { readJson, withErrors } from "@/server/http"
import { resolveRepo } from "@/server/repo"

export const GET = withErrors("Failed to list agent sessions", async req => {
  const params = req.nextUrl.searchParams
  const repo = await resolveRepo(params.get("repo"))
  const agent = params.get("agent")
  if (params.get("scope") === "live") {
    const sessions = await listLiveSessions(repo, agent)
    return NextResponse.json({ sessions, nextCursor: null } satisfies SessionsResponse)
  }
  const page = await listPastSessions(repo, agent, params.get("cursor"))
  return NextResponse.json(page satisfies SessionsResponse)
})

export const POST = withErrors("Failed to open agent session", async req => {
  const body = await readJson<OpenSessionRequest>(req)
  const repo = await resolveRepo(body.repo)
  const sessionId = await openSession(repo, body.agent, body.resumeId || undefined)
  return NextResponse.json({ sessionId } satisfies OpenSessionResponse)
})
