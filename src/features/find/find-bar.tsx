import { useEffect, useRef } from "react"
import { ChevronDown, ChevronUp, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FindBarProps {
  query: string
  caseSensitive: boolean
  total: number
  index: number
  onQueryChange: (value: string) => void
  onCaseToggle: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

export function FindBar({ query, caseSensitive, total, index, onQueryChange, onCaseToggle, onPrev, onNext, onClose }: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const displayIndex = total > 0 ? ((index % total) + total) % total + 1 : 0

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1">
      <Search size={14} className="shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        data-find-input
        type="text"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (e.shiftKey) onPrev()
            else onNext()
          } else if (e.key === "Escape") {
            e.preventDefault()
            onClose()
          }
        }}
        placeholder="Find…"
        className="h-7 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <Button
        type="button"
        variant={caseSensitive ? "default" : "outline"}
        size="icon"
        className="h-6 w-6 shrink-0 text-[10px]"
        title="Match case"
        onClick={onCaseToggle}
      >
        <span className={caseSensitive ? "underline" : ""}>Aa</span>
      </Button>
      <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground">
        {displayIndex}/{total}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-6 w-6 shrink-0"
        title="Previous match (Shift+Enter)"
        disabled={total === 0}
        onClick={onPrev}
      >
        <ChevronUp size={14} />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-6 w-6 shrink-0"
        title="Next match (Enter)"
        disabled={total === 0}
        onClick={onNext}
      >
        <ChevronDown size={14} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground"
        title="Close (Esc)"
        onClick={onClose}
      >
        <X size={14} />
      </Button>
    </div>
  )
}
