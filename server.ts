import { createServer } from "http"
import next from "next"
import { parse } from "url"
import { WebSocketServer, WebSocket } from "ws"
import * as pty from "node-pty"

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME ?? "0.0.0.0"
const port = parseInt(process.env.PORT ?? "3000", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

const shell = process.env.SHELL ?? "/bin/sh"

const wss = new WebSocketServer({ noServer: true })

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "", `http://${req.headers.host}`)
  const repo = url.searchParams.get("repo") ?? process.cwd()

  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: repo,
    env: process.env as { [key: string]: string },
  })

  ptyProcess.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })

  ptyProcess.onExit(() => {
    ws.close()
  })

  ws.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg.toString())
      if (parsed.type === "input" && typeof parsed.data === "string") {
        ptyProcess.write(parsed.data)
      } else if (parsed.type === "resize" && typeof parsed.cols === "number" && typeof parsed.rows === "number") {
        ptyProcess.resize(parsed.cols, parsed.rows)
      }
    } catch {
      // ignore invalid messages
    }
  })

  ws.on("close", () => {
    ptyProcess.kill()
  })
})

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  server.on("upgrade", (request, socket, head) => {
    if (request.url?.startsWith("/_terminal")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request)
      })
    }
  })

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
