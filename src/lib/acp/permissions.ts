import type { PermissionOption } from "@agentclientprotocol/sdk"

// Option auto mode picks: a one-off grant first so the agent never stores a
// standing permission, then allow_always. null = no allow option offered,
// so the request has to go to the user.
export function autoApproveOption(options: PermissionOption[]): PermissionOption | null {
  return options.find(o => o.kind === "allow_once") ?? options.find(o => o.kind === "allow_always") ?? null
}
