import { useCallback, useRef, useState } from "react"
import { api } from "@/lib/api-client"
import type { AgentSessionSummary } from "@/lib/acp/types"

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Sessions for the picker, loaded only while it is open: the live ones (the
// server answers instantly) and past ones page by page, as the list scrolls.
export function useSessionList(repo: string, agentId: string) {
  const [live, setLive] = useState<AgentSessionSummary[]>([])
  const [past, setPast] = useState<AgentSessionSummary[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingLive, setLoadingLive] = useState(false)
  const [loadingPast, setLoadingPast] = useState(false)
  const [error, setError] = useState("")
  // Bumped by reload so answers for an older list are dropped.
  const generationRef = useRef(0)
  const pastInFlightRef = useRef(false)

  const fetchPast = useCallback(async (generation: number, from: string | null) => {
    pastInFlightRef.current = true
    setLoadingPast(true)
    try {
      const page = await api.acp.pastSessions(repo, agentId, from ?? undefined)
      if (generation !== generationRef.current) return
      setPast(prev => {
        const seen = new Set(prev.map(s => s.sessionId))
        return [...prev, ...page.sessions.filter(s => !seen.has(s.sessionId))]
      })
      setCursor(page.nextCursor)
      setHasMore(page.nextCursor !== null)
    } catch (e) {
      if (generation === generationRef.current) {
        setError(errorText(e))
        setHasMore(false)
      }
    } finally {
      if (generation === generationRef.current) {
        pastInFlightRef.current = false
        setLoadingPast(false)
      }
    }
  }, [repo, agentId])

  // Starts over: called every time the picker opens, so the list is fresh.
  const reload = useCallback(() => {
    if (!agentId) return
    const generation = ++generationRef.current
    setLive([])
    setPast([])
    setCursor(null)
    setHasMore(true)
    setError("")
    setLoadingLive(true)
    api.acp.liveSessions(repo, agentId).then(
      list => { if (generation === generationRef.current) setLive(list) },
      e => { if (generation === generationRef.current) setError(errorText(e)) },
    ).finally(() => {
      if (generation === generationRef.current) setLoadingLive(false)
    })
    void fetchPast(generation, null)
  }, [repo, agentId, fetchPast])

  const loadMore = useCallback(() => {
    if (pastInFlightRef.current || !hasMore || cursor === null) return
    void fetchPast(generationRef.current, cursor)
  }, [hasMore, cursor, fetchPast])

  return { live, past, hasMore, loadingLive, loadingPast, error, reload, loadMore }
}
