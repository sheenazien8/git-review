import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth"

export async function POST() {
  const cookie = clearSessionCookie()
  const res = NextResponse.json({ success: true })
  res.headers.set("Set-Cookie", cookie)
  return res
}
