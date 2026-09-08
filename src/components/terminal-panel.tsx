"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Terminal as XTerm } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { Button } from "@/components/ui/button"
import { X, Plus, TerminalIcon } from "lucide-react"

interface TerminalSession {
  id: string
  name: string
  ws: WebSocket | null
  term: XTerm | null
  fitAddon: FitAddon | null
  containerRef: React.RefObject<HTMLDivElement | null>
}

function createSession(index: number): TerminalSession {
  return {
    id: crypto.randomUUID(),
    name: `Session ${index}`,
    ws: null,
    term: null,
    fitAddon: null,
    containerRef: { current: null },
  }
}

export default function TerminalPanel({
  repoPath,
  visible,
  isDark,
}: {
  repoPath: string
  visible: boolean
  isDark: boolean
}) {
  const [sessions, setSessions] = useState<TerminalSession[]>(() => [createSession(1)])
  const [activeId, setActiveId] = useState<string>(sessions[0].id)
  const nextIndexRef = useRef(2)

  // When repo changes, clear all sessions and start fresh
  useEffect(() => {
    // Kill existing sessions
    for (const s of sessions) {
      s.ws?.close()
      s.term?.dispose()
    }
    const fresh = [createSession(1)]
    nextIndexRef.current = 2
    setSessions(fresh)
    setActiveId(fresh[0].id)
  }, [repoPath])

  // Initialize terminal for a session when it becomes active and doesn't have one yet
  useEffect(() => {
    if (!visible) return

    const session = sessions.find((s) => s.id === activeId)
    if (!session || session.term) return

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"JetBrainsMono Nerd Font Mono", var(--font-geist-mono), monospace',
      fontSize: 12,
      lineHeight: 1.2,
      theme: isDark
        ? {
            background: "#0a0a0a",
            foreground: "#ededed",
            cursor: "#ededed",
            selectionBackground: "#525252",
            black: "#171717",
            red: "#ef4444",
            green: "#22c55e",
            yellow: "#eab308",
            blue: "#3b82f6",
            magenta: "#a855f7",
            cyan: "#06b6d4",
            white: "#e5e5e5",
            brightBlack: "#525252",
            brightRed: "#f87171",
            brightGreen: "#4ade80",
            brightYellow: "#facc15",
            brightBlue: "#60a5fa",
            brightMagenta: "#c084fc",
            brightCyan: "#67e8f9",
            brightWhite: "#ffffff",
          }
        : {
            background: "#ffffff",
            foreground: "#171717",
            cursor: "#171717",
            selectionBackground: "#a3a3a3",
            black: "#171717",
            red: "#ef4444",
            green: "#22c55e",
            yellow: "#eab308",
            blue: "#3b82f6",
            magenta: "#a855f7",
            cyan: "#06b6d4",
            white: "#e5e5e5",
            brightBlack: "#737373",
            brightRed: "#f87171",
            brightGreen: "#4ade80",
            brightYellow: "#facc15",
            brightBlue: "#60a5fa",
            brightMagenta: "#c084fc",
            brightCyan: "#67e8f9",
            brightWhite: "#ffffff",
          },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    const container = session.containerRef.current
    if (container) {
      // Wait for the nerd font to load so xterm.js measures correct cell widths
      document.fonts
        .load('12px "JetBrainsMono Nerd Font Mono"')
        .then(() => {
          term.open(container)
          try {
            fitAddon.fit()
            const dims = fitAddon.proposeDimensions()
            if (dims) {
              term.resize(dims.cols, dims.rows)
            }
          } catch {
            // ignore fit errors on initial mount
          }
        })
        .catch(() => {
          // fallback: open anyway if font load fails
          term.open(container)
        })
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const ws = new WebSocket(`${protocol}//${window.location.host}/_terminal?repo=${encodeURIComponent(repoPath)}`)

    ws.onopen = () => {
      const dims = fitAddon.proposeDimensions()
      if (dims) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }))
      }
    }

    ws.onmessage = (event) => {
      term.write(event.data as string)
    }

    ws.onclose = () => {
      term.write("\r\n\n[Disconnected]\n")
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }))
      }
    })

    // Update session with initialized objects
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, ws, term, fitAddon } : s
      )
    )

    return () => {
      // Don't dispose here — we keep the terminal alive for tab switching.
      // Disposal happens when the session is closed or repo changes.
    }
  }, [activeId, visible, repoPath, isDark])

  // Update theme on all terminals when dark mode changes
  useEffect(() => {
    const theme = isDark
      ? {
          background: "#0a0a0a",
          foreground: "#ededed",
          cursor: "#ededed",
          selectionBackground: "#525252",
          black: "#171717",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#e5e5e5",
          brightBlack: "#525252",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#facc15",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#67e8f9",
          brightWhite: "#ffffff",
        }
      : {
          background: "#ffffff",
          foreground: "#171717",
          cursor: "#171717",
          selectionBackground: "#a3a3a3",
          black: "#171717",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#e5e5e5",
          brightBlack: "#737373",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#facc15",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#67e8f9",
          brightWhite: "#ffffff",
        }
    for (const s of sessions) {
      if (s.term) {
        s.term.options.theme = theme
      }
    }
  }, [isDark, sessions])

  // Handle resize
  useEffect(() => {
    const onResize = () => {
      const session = sessions.find((s) => s.id === activeId)
      if (session?.fitAddon) {
        try {
          session.fitAddon.fit()
          const dims = session.fitAddon.proposeDimensions()
          if (dims && session.ws?.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }))
          }
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [activeId, sessions])

  // Fit when tab becomes active
  useEffect(() => {
    const session = sessions.find((s) => s.id === activeId)
    if (session?.fitAddon) {
      requestAnimationFrame(() => {
        try {
          session.fitAddon!.fit()
          const dims = session.fitAddon!.proposeDimensions()
          if (dims && session.ws?.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }))
          }
        } catch {
          // ignore
        }
      })
    }
  }, [activeId, sessions, visible])

  const addSession = useCallback(() => {
    const idx = nextIndexRef.current++
    const newSession = createSession(idx)
    setSessions((prev) => [...prev, newSession])
    setActiveId(newSession.id)
  }, [])

  const closeSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const session = prev.find((s) => s.id === id)
        if (session) {
          session.ws?.close()
          session.term?.dispose()
        }
        const next = prev.filter((s) => s.id !== id)
        if (next.length === 0) {
          nextIndexRef.current = 2
          const fresh = createSession(1)
          next.push(fresh)
          setTimeout(() => setActiveId(fresh.id), 0)
        } else if (activeId === id) {
          const i = prev.findIndex((s) => s.id === id)
          const newActive = next[Math.min(i, next.length - 1)]
          setTimeout(() => setActiveId(newActive.id), 0)
        }
        return next
      })
    },
    [activeId]
  )

  if (!visible) return null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/50 px-2 py-1.5">
        <TerminalIcon size={14} className="mr-1 text-muted-foreground" />
        {sessions.map((session) => {
          const isActive = session.id === activeId
          return (
            <button
              key={session.id}
              onClick={() => setActiveId(session.id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{session.name}</span>
              {sessions.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    closeSession(session.id)
                  }}
                  className="ml-0.5 inline-flex cursor-pointer rounded-sm p-0.5 hover:bg-destructive/10 hover:text-destructive"
                  title="Close session"
                >
                  <X size={12} />
                </span>
              )}
            </button>
          )
        })}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="New session"
          onClick={addSession}
        >
          <Plus size={14} />
        </Button>
      </div>

      {/* Terminal containers */}
      <div className="relative min-h-0 flex-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            ref={session.containerRef}
            className={`absolute inset-0 p-2 ${
              session.id === activeId ? "block" : "hidden"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
