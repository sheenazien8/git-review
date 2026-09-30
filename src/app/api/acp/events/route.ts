import type { SeqEvent } from "@/lib/acp/types"
import { getSession } from "@/server/acp/registry"
import { withErrors } from "@/server/http"

export const dynamic = "force-dynamic"

const HEARTBEAT_MS = 15_000

// Server-sent events for one session: replays the buffered log after
// Last-Event-ID (EventSource sends it on reconnect), then streams live.
export const GET = withErrors("Failed to open event stream", async req => {
  const session = getSession(req.nextUrl.searchParams.get("sessionId"))
  const lastSeq = Number(req.headers.get("last-event-id") ?? 0) || 0
  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true
      const write = (text: string) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          cleanup()
        }
      }
      const send = ({ seq, event }: SeqEvent) => write(`id: ${seq}\ndata: ${JSON.stringify(event)}\n\n`)

      write("retry: 2000\n\n")
      const { reset, events } = session.since(lastSeq)
      if (reset) {
        write(`data: ${JSON.stringify({ type: "reset" })}\n\n`)
        write(`data: ${JSON.stringify({ type: "config", config: session.config })}\n\n`)
      }
      events.forEach(send)

      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS)
      const unsubscribe = session.subscribe(send, () => cleanup())
      cleanup = () => {
        if (!open) return
        open = false
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {}
      }
      if (!session.connected) cleanup()
      req.signal.addEventListener("abort", () => cleanup())
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform keeps the compression middleware from buffering it
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
})
