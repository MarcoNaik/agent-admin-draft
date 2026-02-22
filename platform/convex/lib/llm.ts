import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createXai } from "@ai-sdk/xai"
import type { LanguageModel, ModelMessage } from "ai"

interface ModelConfig {
  provider: string
  name: string
  temperature?: number
  maxTokens?: number
}

const BUILTIN_PREFIXES = ["entity", "event", "agent", "calendar"]

export function createModel(config: ModelConfig, apiKeyOverride?: string): LanguageModel {
  switch (config.provider) {
    case "anthropic": {
      const apiKey = apiKeyOverride ?? process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured")
      const provider = createAnthropic({ apiKey })
      return provider(config.name)
    }
    case "openai": {
      const apiKey = apiKeyOverride ?? process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error("OPENAI_API_KEY not configured")
      const provider = createOpenAI({ apiKey })
      return provider(config.name)
    }
    case "google": {
      const apiKey = apiKeyOverride ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
      if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured")
      const provider = createGoogleGenerativeAI({ apiKey })
      return provider(config.name)
    }
    case "xai": {
      const apiKey = apiKeyOverride ?? process.env.XAI_API_KEY
      if (!apiKey) throw new Error("XAI_API_KEY not configured")
      const provider = createXai({ apiKey })
      return provider(config.name)
    }
    default:
      throw new Error(`Unsupported model provider: ${config.provider}`)
  }
}

export function sanitizeToolName(name: string): string {
  return name.replace(/\./g, "_")
}

export function desanitizeToolName(name: string): string {
  for (const prefix of BUILTIN_PREFIXES) {
    if (name.startsWith(`${prefix}_`)) {
      return name.replace(`${prefix}_`, `${prefix}.`)
    }
  }
  return name
}

interface InternalMessage {
  role: "user" | "assistant" | "system" | "tool"
  content: string
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
  toolCallId?: string
}

export function toAIMessages(messages: InternalMessage[]): ModelMessage[] {
  const result: ModelMessage[] = []
  const toolNameMap = new Map<string, string>()

  for (const m of messages) {
    if (m.role === "system") continue

    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      const parts: Array<{ type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }> = []
      if (m.content) {
        parts.push({ type: "text", text: m.content })
      }
      for (const tc of m.toolCalls) {
        const sanitized = sanitizeToolName(tc.name)
        toolNameMap.set(tc.id, sanitized)
        parts.push({
          type: "tool-call",
          toolCallId: tc.id,
          toolName: sanitized,
          input: tc.arguments,
        })
      }
      result.push({ role: "assistant", content: parts } as ModelMessage)
      continue
    }

    if (m.role === "tool" && m.toolCallId) {
      const toolName = toolNameMap.get(m.toolCallId) ?? "unknown"
      let output: { type: "json"; value: unknown } | { type: "text"; value: string }
      try {
        const parsed = JSON.parse(m.content)
        output = { type: "json", value: parsed }
      } catch {
        output = { type: "text", value: m.content }
      }
      result.push({
        role: "tool",
        content: [{
          type: "tool-result",
          toolCallId: m.toolCallId,
          toolName,
          output,
        }],
      } as ModelMessage)
      continue
    }

    if (m.role === "assistant") {
      if (!m.content) continue
      result.push({ role: "assistant", content: m.content } as ModelMessage)
      continue
    }

    if (m.role === "user") {
      result.push({ role: "user", content: m.content } as ModelMessage)
    }
  }

  return result
}

interface StepData {
  text: string
  toolCalls: Array<{ toolCallId: string; toolName: string; input?: unknown; args?: unknown }>
  toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }>
}

export function fromSteps(steps: StepData[]): InternalMessage[] {
  const result: InternalMessage[] = []

  for (const step of steps) {
    if (step.toolCalls.length > 0) {
      result.push({
        role: "assistant",
        content: step.text || "",
        toolCalls: step.toolCalls.map((tc) => ({
          id: tc.toolCallId,
          name: desanitizeToolName(tc.toolName),
          arguments: ((tc.input ?? tc.args) ?? {}) as Record<string, unknown>,
        })),
      })

      for (const tr of step.toolResults) {
        result.push({
          role: "tool",
          content: JSON.stringify(tr.output),
          toolCallId: tr.toolCallId,
        })
      }
    } else if (step.text) {
      result.push({
        role: "assistant",
        content: step.text,
      })
    }
  }

  return result
}
