import { describe, expect, test } from "bun:test"
import { defineAgent } from "../agent"

describe("defineAgent", () => {
  test("returns config with default model when no model specified", () => {
    const config = defineAgent({
      name: "Test Agent",
      slug: "test-agent",
      version: "1.0.0",
      systemPrompt: "You are a test agent.",
    })
    expect(config.model).toEqual({
      model: "xai/grok-4-1-fast",
      temperature: 0.7,
      maxTokens: 4096,
    })
  })

  test("throws when name is missing", () => {
    expect(() =>
      defineAgent({
        name: "",
        slug: "test",
        version: "1.0.0",
        systemPrompt: "prompt",
      })
    ).toThrow("Agent name is required")
  })

  test("throws when version is missing", () => {
    expect(() =>
      defineAgent({
        name: "Test",
        slug: "test",
        version: "",
        systemPrompt: "prompt",
      })
    ).toThrow("Agent version is required")
  })

  test("throws when systemPrompt is missing", () => {
    expect(() =>
      defineAgent({
        name: "Test",
        slug: "test",
        version: "1.0.0",
        systemPrompt: "",
      })
    ).toThrow("System prompt is required")
  })

  test("preserves all provided fields", () => {
    const config = defineAgent({
      name: "My Agent",
      slug: "my-agent",
      version: "2.0.0",
      description: "A custom agent",
      systemPrompt: "You are helpful.",
      model: {
        model: "anthropic/claude-sonnet-4",
        temperature: 0.5,
        maxTokens: 2048,
      },
      tools: ["entity.create", "entity.query"],
      firstMessageSuggestions: ["Hello!", "Help me"],
    })
    expect(config.name).toBe("My Agent")
    expect(config.slug).toBe("my-agent")
    expect(config.version).toBe("2.0.0")
    expect(config.description).toBe("A custom agent")
    expect(config.systemPrompt).toBe("You are helpful.")
    expect(config.model!.model).toBe("anthropic/claude-sonnet-4")
    expect(config.model!.temperature).toBe(0.5)
    expect(config.model!.maxTokens).toBe(2048)
    expect(config.tools).toEqual(["entity.create", "entity.query"])
    expect(config.firstMessageSuggestions).toEqual(["Hello!", "Help me"])
  })

  test("user-provided model overrides default model", () => {
    const config = defineAgent({
      name: "Test",
      slug: "test",
      version: "1.0.0",
      systemPrompt: "prompt",
      model: {
        model: "openai/gpt-4o",
      },
    })
    expect(config.model!.model).toBe("openai/gpt-4o")
  })
})
