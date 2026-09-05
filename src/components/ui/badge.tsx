import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "secondary" | "destructive" | "outline" }>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants: Record<string, string> = {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      outline: "border border-border text-foreground",
    }
    return (
      <span
        ref={ref}
        className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant], className)}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
