import "server-only"
import path from "path"
import { readFile } from "fs/promises"
import { HttpError } from "../http"

export interface AgentConfig {
  id: string
  name: string
  // argv of an ACP agent speaking JSON-RPC over stdio. Only ever read from
  // the server's config file — never from a request.
  command: string[]
  env?: Record<string, string>
}

const DEFAULT_AGENTS: AgentConfig[] = [
  { id: "claude", name: "Claude", command: ["claude-agent-acp"] },
]

function isAgentConfig(value: unknown): value is AgentConfig {
  const a = value as AgentConfig | null
  return !!a
    && typeof a.id === "string" && a.id !== ""
    && typeof a.name === "string"
    && Array.isArray(a.command) && a.command.length > 0 && a.command.every(c => typeof c === "string" && c !== "")
    && (a.env === undefined || (typeof a.env === "object" && Object.values(a.env).every(v => typeof v === "string")))
}

export function configPath(): string {
  // GIT_REVIEW_ACP_CONFIG is the pre-rebrand name, still honoured.
  return process.env.HUNK_ACP_CONFIG || process.env.GIT_REVIEW_ACP_CONFIG || path.join(process.cwd(), "acp.config.json")
}

// Agents from acp.config.json (read on every call, like ignore.config.json),
// or a single claude-agent-acp entry when the file is missing or malformed.
export async function loadAgents(file = configPath()): Promise<AgentConfig[]> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf-8")) as { agents?: unknown }
    if (Array.isArray(parsed.agents)) {
      const agents = parsed.agents.filter(isAgentConfig)
      if (agents.length > 0) return agents
    }
  } catch {
    // missing or malformed -> defaults
  }
  return DEFAULT_AGENTS
}

export async function findAgent(id: string | null | undefined): Promise<AgentConfig> {
  const agents = await loadAgents()
  const agent = id ? agents.find(a => a.id === id) : agents[0]
  if (!agent) throw new HttpError(400, `Unknown agent: ${id}`)
  return agent
}
