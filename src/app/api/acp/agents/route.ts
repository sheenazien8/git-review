import { NextResponse } from "next/server"
import type { AgentsResponse } from "@/lib/acp/types"
import { loadAgents } from "@/server/acp/config"
import { withErrors } from "@/server/http"

export const GET = withErrors("Failed to load agents", async () => {
  const agents = (await loadAgents()).map(({ id, name }) => ({ id, name }))
  return NextResponse.json({ agents } satisfies AgentsResponse)
})
