import { describe, expect, it } from "vitest"
import type { SessionConfigOption } from "@agentclientprotocol/sdk"
import { configControls, formatTokens, usagePercent } from "./agent-config"
import type { SessionConfig } from "./types"

const select = (id: string, category: string, currentValue: string, values: string[]): SessionConfigOption =>
  ({ type: "select", id, name: id, category, currentValue, options: values.map(v => ({ value: v, name: v.toUpperCase() })) })

const config = (configOptions: SessionConfigOption[], modes: SessionConfig["modes"] = null): SessionConfig =>
  ({ configOptions, modes, usage: null })

describe("configControls", () => {
  it("orders mode, model, thinking, then the rest, and names the current value", () => {
    const controls = configControls(config([
      select("effort", "thought_level", "low", ["low", "high"]),
      select("extra", "other", "a", ["a"]),
      select("model", "model", "opus", ["opus", "haiku"]),
      select("mode", "mode", "plan", ["default", "plan"]),
    ]))
    expect(controls.map(c => c.id)).toEqual(["mode", "model", "effort", "extra"])
    expect(controls[1]).toMatchObject({ kind: "select", source: "config", current: "opus", currentName: "OPUS" })
  })

  it("keeps option groups and boolean options", () => {
    const grouped: SessionConfigOption = {
      type: "select", id: "model", name: "Model", category: "model", currentValue: "b",
      options: [{ group: "g1", name: "Anthropic", options: [{ value: "a", name: "A" }] }, { group: "g2", name: "Other", options: [{ value: "b", name: "B" }] }],
    }
    const flag: SessionConfigOption = { type: "boolean", id: "fast", name: "Fast", currentValue: true }
    const [model, fast] = configControls(config([grouped, flag]))
    expect(model).toMatchObject({ currentName: "B", groups: [{ name: "Anthropic" }, { name: "Other" }] })
    expect(fast).toEqual({ kind: "boolean", id: "fast", name: "Fast", category: "other", current: true, description: undefined })
  })

  it("uses the legacy mode list only without config options", () => {
    const modes = { currentModeId: "ask", availableModes: [{ id: "ask", name: "Ask" }, { id: "code", name: "Code" }] }
    expect(configControls(config([], modes))).toEqual([expect.objectContaining({ source: "mode", current: "ask", currentName: "Ask" })])
    expect(configControls(config([select("model", "model", "x", ["x"])], modes)).map(c => c.id)).toEqual(["model"])
  })
})

describe("usage", () => {
  it("computes a clamped percentage", () => {
    expect(usagePercent({ used: 50, size: 200 })).toBe(25)
    expect(usagePercent({ used: 500, size: 200 })).toBe(100)
    expect(usagePercent({ used: 1, size: 0 })).toBeNull()
    expect(usagePercent(null)).toBeNull()
  })

  it("formats token counts", () => {
    expect(formatTokens(950)).toBe("950")
    expect(formatTokens(1234)).toBe("1.2k")
    expect(formatTokens(200_000)).toBe("200k")
    expect(formatTokens(1_000_000)).toBe("1.0M")
  })
})
