import { describe, expect, test } from "bun:test"
import { VIRTUAL_MODULE_SOURCE } from "../plugin"

describe("virtual module consistency", () => {
  test("exports match real define functions", () => {
    const exportMatch = VIRTUAL_MODULE_SOURCE.match(/export\s*\{([^}]+)\}/)
    expect(exportMatch).toBeTruthy()
    const virtualExports = exportMatch![1].split(",").map(s => s.trim()).filter(Boolean).sort()
    expect(virtualExports).toContain("defineAgent")
    expect(virtualExports).toContain("defineRole")
    expect(virtualExports).toContain("defineData")
    expect(virtualExports).toContain("defineTrigger")
    expect(virtualExports).toContain("defineTools")
  })

  test("virtual module exports exactly 5 functions", () => {
    const exportMatch = VIRTUAL_MODULE_SOURCE.match(/export\s*\{([^}]+)\}/)
    expect(exportMatch).toBeTruthy()
    const virtualExports = exportMatch![1].split(",").map(s => s.trim()).filter(Boolean)
    expect(virtualExports).toHaveLength(5)
  })

  test("defineAgent in virtual module validates required fields", () => {
    const stripped = VIRTUAL_MODULE_SOURCE.replace(/export\s*\{[^}]+\}/, "")
    const fn = new Function(stripped + "\nreturn defineAgent;")
    const defineAgent = fn()
    expect(() => defineAgent({ slug: "test", version: "1.0", systemPrompt: "p" })).toThrow("Agent name is required")
    expect(() => defineAgent({ name: "Test", slug: "test", systemPrompt: "p" })).toThrow("Agent version is required")
    expect(() => defineAgent({ name: "Test", slug: "test", version: "1.0" })).toThrow("System prompt is required")
  })

  test("defineAgent in virtual module provides default model", () => {
    const stripped = VIRTUAL_MODULE_SOURCE.replace(/export\s*\{[^}]+\}/, "")
    const fn = new Function(stripped + "\nreturn defineAgent;")
    const defineAgent = fn()
    const config = defineAgent({ name: "Test", slug: "test", version: "1.0", systemPrompt: "p" })
    expect(config.model.model).toBe("xai/grok-4-1-fast")
  })
})
