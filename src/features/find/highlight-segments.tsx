import { useEffect } from "react"
import { cn } from "@/lib/utils"
import type { HighlightSegment } from "./find"

export function HighlightSegments({ segments }: { segments: HighlightSegment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "mark" ? (
          <mark
            key={i}
            className={cn(
              "rounded-sm",
              seg.active
                ? "bg-primary text-primary-foreground ring-1 ring-ring"
                : "bg-primary/25 text-foreground"
            )}
            data-find-match={seg.active ? seg.globalIndex : undefined}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  )
}

export function ScrollToActiveMatch({ index }: { index: number | undefined }) {
  useEffect(() => {
    if (index === undefined || index < 0) return
    const el = document.querySelector(`[data-find-match="${index}"]`)
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "center", inline: "nearest" })
    }
  }, [index])
  return null
}

// Focuses the find input once it has rendered (after opening the find bar).
export function focusFindInput() {
  window.setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>("[data-find-input]")
    input?.focus()
    input?.select()
  }, 0)
}
