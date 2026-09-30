import { describe, expect, it } from "vitest"
import { clampAgentWidth } from "./agent-frame"

describe("clampAgentWidth", () => {
  it("keeps the width between the min and max", () => {
    expect(clampAgentWidth(100)).toBe(320)
    expect(clampAgentWidth(5000)).toBe(1200)
    expect(clampAgentWidth(500.4)).toBe(500)
  })

  it("leaves the viewer at least 30% of the viewport", () => {
    expect(clampAgentWidth(1000, 1000)).toBe(700)
    expect(clampAgentWidth(1000, 300)).toBe(320)
  })
})
