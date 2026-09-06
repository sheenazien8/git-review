import { NextRequest, NextResponse } from "next/server"
import { getAuthUsername, getAuthPassword, signToken, setSessionCookie } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body || {}

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    const validUsername = getAuthUsername()
    const validPassword = getAuthPassword()

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    const token = await signToken({ username })
    const cookie = setSessionCookie(token)

    const res = NextResponse.json({ success: true, username })
    res.headers.set("Set-Cookie", cookie)
    return res
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
