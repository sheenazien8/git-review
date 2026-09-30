import "server-only"
import { NextRequest, NextResponse } from "next/server"

// Thrown from the server layer to produce a specific HTTP status; anything
// else that escapes a handler becomes a 500.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// Prefers git's stderr (the useful part of a failed execFile) over the
// generic "Command failed: …" message.
export function errorMessage(e: unknown, fallback: string): string {
  const stderr = (e as { stderr?: string } | null)?.stderr
  if (stderr && stderr.trim()) return stderr.trim()
  return e instanceof Error && e.message ? e.message : fallback
}

type Handler = (req: NextRequest) => Promise<Response>

export function withErrors(fallback: string, handler: Handler): Handler {
  return async req => {
    try {
      return await handler(req)
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status })
      }
      return NextResponse.json({ error: errorMessage(e, fallback) }, { status: 500 })
    }
  }
}

export async function readJson<T>(req: NextRequest): Promise<T> {
  try {
    return await req.json()
  } catch {
    throw new HttpError(400, "Invalid JSON body")
  }
}

export function requireParam(value: string | null | undefined, message: string): string {
  if (!value) throw new HttpError(400, message)
  return value
}
