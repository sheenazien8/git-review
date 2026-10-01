// Compact relative time: "now", "5m", "3h", "2d", then a plain date.
export function timeAgo(iso: string | undefined): string {
  if (!iso) return ""
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (!Number.isFinite(minutes)) return ""
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days}d` : new Date(iso).toLocaleDateString()
}
