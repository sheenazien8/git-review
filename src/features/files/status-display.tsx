import { ChevronRight, File, FileMinus, FilePen, FilePlus, Plus } from "lucide-react"

export function statusIcon(s: string) {
  switch (s) {
    case "modified": return <FilePen size={14} />
    case "added": return <FilePlus size={14} />
    case "deleted": return <FileMinus size={14} />
    case "untracked": return <Plus size={14} />
    case "renamed": return <ChevronRight size={14} />
    default: return <File size={14} />
  }
}

export function statusBadgeColor(s: string) {
  switch (s) {
    case "modified": return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700"
    case "added": return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700"
    case "deleted": return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700"
    default: return "bg-muted text-muted-foreground border-border"
  }
}

export function statusLabel(s: string) {
  switch (s) {
    case "modified": return "Modified"
    case "added": return "Added"
    case "deleted": return "Deleted"
    case "untracked": return "Untracked"
    case "renamed": return "Renamed"
    default: return "Unknown"
  }
}
