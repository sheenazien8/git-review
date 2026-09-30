import type { SessionConfigOption } from "@agentclientprotocol/sdk"
import type { SessionConfig } from "./types"

// Turns what an agent advertises for a session into the controls of the
// agent config toolbar.

export interface ChoiceOption {
  value: string
  name: string
  description?: string
}

export interface ChoiceGroup {
  // Group label; undefined for an ungrouped list
  name?: string
  options: ChoiceOption[]
}

export type ConfigControl =
  // A select config option, or (source "mode") the legacy session mode list
  | { kind: "select"; source: "config" | "mode"; id: string; name: string; category: string; current: string; currentName: string; description?: string; groups: ChoiceGroup[] }
  | { kind: "boolean"; id: string; name: string; category: string; current: boolean; description?: string }

const CATEGORY_ORDER = ["mode", "model", "thought_level", "model_config"]

function categoryRank(category: string) {
  const i = CATEGORY_ORDER.indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

function toGroups(option: Extract<SessionConfigOption, { type: "select" }>): ChoiceGroup[] {
  const strip = (o: { value: string; name: string; description?: string | null }): ChoiceOption =>
    ({ value: o.value, name: o.name, description: o.description ?? undefined })
  if (option.options.length > 0 && "group" in option.options[0]) {
    return (option.options as { name: string; options: { value: string; name: string; description?: string | null }[] }[])
      .map(g => ({ name: g.name, options: g.options.map(strip) }))
  }
  return [{ options: (option.options as { value: string; name: string; description?: string | null }[]).map(strip) }]
}

// Config options first, in a stable order (mode, model, thinking, other
// model settings, then whatever else). The legacy mode list is only used
// when the agent sends no config options at all — agents that send both
// (pi's modes are its thinking levels) would otherwise show it twice.
export function configControls(config: SessionConfig): ConfigControl[] {
  const controls: ConfigControl[] = config.configOptions.map((o): ConfigControl => {
    const category = o.category ?? "other"
    const description = o.description ?? undefined
    if (o.type === "boolean") return { kind: "boolean", id: o.id, name: o.name, category, current: o.currentValue, description }
    const groups = toGroups(o)
    const currentName = groups.flatMap(g => g.options).find(x => x.value === o.currentValue)?.name ?? o.currentValue
    return { kind: "select", source: "config", id: o.id, name: o.name, category, current: o.currentValue, currentName, description, groups }
  })
  if (controls.length === 0 && config.modes && config.modes.availableModes.length > 0) {
    const { currentModeId, availableModes } = config.modes
    controls.push({
      kind: "select",
      source: "mode",
      id: "mode",
      name: "Mode",
      category: "mode",
      current: currentModeId,
      currentName: availableModes.find(m => m.id === currentModeId)?.name ?? currentModeId,
      groups: [{ options: availableModes.map(m => ({ value: m.id, name: m.name, description: m.description ?? undefined })) }],
    })
  }
  // Stable sort keeps the agent's own order within a category.
  return controls
    .map((c, i) => ({ c, i }))
    .sort((a, b) => categoryRank(a.c.category) - categoryRank(b.c.category) || a.i - b.i)
    .map(({ c }) => c)
}

// Context window use as a whole percentage (0–100), or null when unknown.
export function usagePercent(usage: SessionConfig["usage"]): number | null {
  if (!usage || !(usage.size > 0)) return null
  return Math.min(100, Math.max(0, Math.round((usage.used / usage.size) * 100)))
}

// "12.3k" style token counts for the usage tooltip.
export function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}
