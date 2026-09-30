import { useMemo } from "react"
import { Brain, Cpu, Gauge, Loader2, ShieldCheck, SlidersHorizontal } from "lucide-react"
import { configControls, formatTokens, usagePercent, type ConfigControl } from "@/lib/acp/agent-config"
import { cn } from "@/lib/utils"
import type { Agent } from "./use-agent"

function CategoryIcon({ category }: { category: string }) {
  const props = { size: 12, className: "shrink-0" }
  switch (category) {
    case "mode":
      return <ShieldCheck {...props} />
    case "model":
      return <Cpu {...props} />
    case "thought_level":
      return <Brain {...props} />
    default:
      return <SlidersHorizontal {...props} />
  }
}

function SelectControl({ control, busy, disabled, onChange }: {
  control: Extract<ConfigControl, { kind: "select" }>
  busy: boolean
  disabled: boolean
  onChange: (value: string) => void
}) {
  const grouped = control.groups.some(g => g.name)
  return (
    <label
      className="relative flex h-7 min-w-0 max-w-[14rem] items-center rounded-md border border-input bg-background text-muted-foreground focus-within:ring-2 focus-within:ring-ring hover:text-foreground"
      title={`${control.name}: ${control.currentName}${control.description ? `\n${control.description}` : ""}`}
    >
      <span className="pointer-events-none absolute left-2 flex items-center">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <CategoryIcon category={control.category} />}
      </span>
      <span className="sr-only">{control.name}</span>
      <select
        value={control.current}
        disabled={disabled || busy}
        onChange={e => onChange(e.target.value)}
        className="h-full min-w-0 max-w-full cursor-pointer truncate rounded-md bg-transparent pl-6 pr-1 text-xs text-foreground focus:outline-none disabled:cursor-default disabled:opacity-60"
      >
        {grouped
          ? control.groups.map((g, i) => (
              <optgroup key={g.name ?? i} label={g.name ?? ""}>
                {g.options.map(o => <option key={o.value} value={o.value} title={o.description}>{o.name}</option>)}
              </optgroup>
            ))
          : control.groups[0]?.options.map(o => <option key={o.value} value={o.value} title={o.description}>{o.name}</option>)}
      </select>
    </label>
  )
}

function BooleanControl({ control, busy, disabled, onChange }: {
  control: Extract<ConfigControl, { kind: "boolean" }>
  busy: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={control.current}
      disabled={disabled || busy}
      onClick={() => onChange(!control.current)}
      title={`${control.name}: ${control.current ? "on" : "off"}${control.description ? `\n${control.description}` : ""}`}
      className={cn(
        "flex h-7 items-center gap-1 rounded-md border px-2 text-xs disabled:opacity-60",
        control.current ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <CategoryIcon category={control.category} />}
      {control.name}
    </button>
  )
}

function UsageMeter({ usage }: { usage: { used: number; size: number } }) {
  const percent = usagePercent(usage)
  if (percent === null) return null
  return (
    <div
      className={cn("flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums", percent >= 90 ? "text-destructive" : "text-muted-foreground")}
      title={`Context: ${formatTokens(usage.used)} of ${formatTokens(usage.size)} tokens`}
    >
      <Gauge size={12} className="shrink-0" />
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Context used" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", percent >= 90 ? "bg-destructive" : "bg-primary")} style={{ width: `${percent}%` }} />
      </div>
      {percent}%
    </div>
  )
}

// The agent's own settings for this session (model, thinking level, mode…,
// whatever it advertises over ACP) and how full its context is.
export function ConfigBar({ agent }: { agent: Agent }) {
  const { config, state } = agent.transcript
  const controls = useMemo(() => configControls(config), [config])
  if (!agent.sessionId || (controls.length === 0 && !config.usage)) return null
  const disabled = !state.connected || agent.streamStatus === "closed"

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-2 pb-2">
      {controls.map(control =>
        control.kind === "boolean" ? (
          <BooleanControl
            key={control.id}
            control={control}
            busy={agent.configPending === control.id}
            disabled={disabled}
            onChange={value => void agent.setConfig(control.id, value)}
          />
        ) : (
          <SelectControl
            key={control.id}
            control={control}
            busy={agent.configPending === control.id}
            disabled={disabled}
            onChange={value => void (control.source === "mode" ? agent.setMode(value) : agent.setConfig(control.id, value))}
          />
        )
      )}
      <div className="flex-1" />
      {config.usage && <UsageMeter usage={config.usage} />}
    </div>
  )
}
