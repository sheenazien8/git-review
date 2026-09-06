import { SignJWT, jwtVerify } from "jose"
import { NextRequest } from "next/server"
import { randomBytes } from "crypto"

const COOKIE_NAME = "git-review-session"

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET
  if (!raw) {
    throw new Error(
      "AUTH_SECRET is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    )
  }
  return new TextEncoder().encode(raw)
}

export function getAuthUsername(): string {
  return process.env.BASIC_AUTH_USERNAME || "admin"
}

export function getAuthPassword(): string {
  const password = process.env.BASIC_AUTH_PASSWORD || ""
  if (!password) {
    const generated = randomBytes(16).toString("hex")
    console.warn(`[git-review] BASIC_AUTH_PASSWORD is not set. Temporary generated password: ${generated}`)
    console.warn(`[git-review] Set BASIC_AUTH_PASSWORD in your environment to avoid this message.`)
    return generated
  }
  return password
}

export async function signToken(payload: { username: string }): Promise<string> {
  const secret = getSecret()
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret)
}

export async function verifyToken(token: string): Promise<{ username: string } | null> {
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 })
    if (typeof payload.username === "string") {
      return { username: payload.username }
    }
    return null
  } catch {
    return null
  }
}

export async function getSessionUser(req: NextRequest): Promise<{ username: string } | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export function requireAuth(req: NextRequest): Promise<{ username: string }> {
  return getSessionUser(req).then((user) => {
    if (!user) {
      throw new Error("Unauthorized")
    }
    return user
  })
}

export function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production"
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  }
}

export function setSessionCookie(value: string): string {
  const opts = cookieOptions()
  const parts = [
    `${opts.name}=${value}`,
    `HttpOnly`,
    `Max-Age=${opts.maxAge}`,
    `Path=${opts.path}`,
    `SameSite=${opts.sameSite}`,
  ]
  if (opts.secure) parts.push("Secure")
  return parts.join("; ")
}

export function clearSessionCookie(): string {
  const opts = cookieOptions()
  const parts = [
    `${opts.name}=`,
    `HttpOnly`,
    `Max-Age=0`,
    `Path=${opts.path}`,
    `SameSite=${opts.sameSite}`,
  ]
  if (opts.secure) parts.push("Secure")
  return parts.join("; ")
}
