import { useEffect, useRef } from "react"
import type { BufferEntry } from "@/features/buffer/buffer"

interface Shortcuts {
  active: BufferEntry | null
  entries: BufferEntry[]
  activate: (id: string) => void
  requestClose: (entry: BufferEntry) => void
  openFind: () => void
  closeFind: () => void
  toggleSidebar: () => void
  save: () => void
}

// Global shortcuts:
//   Esc               close the find bar
//   Ctrl/Cmd+F        find in file (not while editing)
//   Ctrl/Cmd+B        toggle the sidebar (VS Code muscle memory)
//   Ctrl/Cmd+S        save while editing
//   Ctrl/Cmd+W        close the active tab
//   Ctrl/Cmd+(Shift+)Tab, Ctrl/Cmd+PageUp/PageDown   cycle tabs
export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  // The listener is bound once and always reads the latest handlers.
  const ref = useRef(shortcuts)
  useEffect(() => {
    ref.current = shortcuts
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { active, entries, activate, requestClose, openFind, closeFind, toggleSidebar, save } = ref.current
      if (e.key === "Escape") {
        if (active?.findOpen) {
          e.preventDefault()
          closeFind()
        }
        return
      }
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === "f" && active && !active.editMode) {
        e.preventDefault()
        openFind()
      } else if (key === "b") {
        e.preventDefault()
        toggleSidebar()
      } else if (key === "s") {
        if (active?.editMode) {
          e.preventDefault()
          save()
        }
      } else if (key === "w" && active) {
        e.preventDefault()
        requestClose(active)
      } else if (key === "tab" || e.key === "PageDown" || e.key === "PageUp") {
        if (entries.length < 2) return
        e.preventDefault()
        const idx = entries.findIndex(b => b.id === active?.id)
        const dir = key === "tab" ? (e.shiftKey ? -1 : 1) : e.key === "PageDown" ? 1 : -1
        const target = entries[(idx + dir + entries.length) % entries.length]
        if (target) activate(target.id)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}
