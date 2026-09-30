import type {
  ActionName,
  ActionPayload,
  ActionResponse,
  AllFilesResponse,
  ContentResponse,
  DiffResponse,
  StatusResponse,
  WorktreesResponse,
} from "@/lib/git/types"

// Typed wrappers around /api/git/*. Every call resolves with the success
// payload or throws an Error carrying the server's `error` message.

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json()
  if (data?.error) throw new Error(data.error)
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return data as T
}

function query(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, v)
  return qs.toString()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export const api = {
  status(repo: string) {
    return request<StatusResponse>(`/api/git/status?${query({ repo })}`)
  },

  worktrees(repo: string) {
    return request<WorktreesResponse>(`/api/git/worktrees?${query({ repo })}`)
  },

  allFiles(repo: string) {
    return request<AllFilesResponse>(`/api/git/all-files?${query({ repo })}`)
  },

  async diff(repo: string, file: string, staged: boolean, oldPath?: string) {
    const qs = query({ repo, file, staged: staged ? "1" : "0", oldPath })
    return (await request<DiffResponse>(`/api/git/diff?${qs}`)).diff
  },

  async content(repo: string, file: string) {
    return (await request<ContentResponse>(`/api/git/content?${query({ repo, file })}`)).content
  },

  async saveContent(repo: string, file: string, content: string) {
    await request(`/api/git/content?${query({ repo, file })}`, json("PUT", { content }))
  },

  async action(repo: string, action: ActionName, payload?: ActionPayload) {
    return (await request<ActionResponse>("/api/git/action", json("POST", { action, repo, ...payload }))).message
  },
}
