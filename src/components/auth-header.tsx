"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, User } from "lucide-react"

export default function AuthHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized")
        return res.json()
      })
      .then((data) => {
        setUsername(data.username)
      })
      .catch(() => {
        setUsername(null)
      })
      .finally(() => setLoading(false))
  }, [pathname])

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
      router.refresh()
    } catch {
    }
  }

  if (pathname === "/login" || loading) return null
  if (!username) return null

  return (
    <header className="border-b bg-background px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User size={14} />
        <span>{username}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut size={14} className="mr-1" />
        Logout
      </Button>
    </header>
  )
}
