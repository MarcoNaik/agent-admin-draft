import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createXai } from "@ai-sdk/xai"
import type { LanguageModel, ModelMessage } from "ai"
import { parseModelId } from "./providers"

const BUILTIN_PREFIXES = ["entity", "event", "agent", "calendar", "whatsapp", "airtable", "email", "web", "payment"]

export function createModel(modelId: string, apiKey: string, tier: number): LanguageModel {
  if (tier === 1) {
    const { provider, modelName } = parseModelId(modelId)
    switch (provider) {
      case "anthropic":
        return createAnthropic({ apiKey })(modelName)
      case "openai":
        return createOpenAI({ apiKey })(modelName)
      case "google":
        return createGoogleGenerativeAI({ apiKey })(modelName)
      case "xai":
        return createXai({ apiKey })(modelName)
      default: {
        const openrouter = createOpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey,
          headers: {
            "HTTP-Referer": "https://struere.dev",
            "X-OpenRouter-Title": "Struere",
          },
        })
        return openrouter(modelId)
      }
    }
  }

  const { modelName: routerModelName } = parseModelId(modelId)
  const openrouterModelId = modelId.startsWith("openrouter/") ? routerModelName : modelId
  const openrouter = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    headers: {
      "HTTP-Referer": "https://struere.dev",
      "X-OpenRouter-Title": "Struere",
    },
  })
  return openrouter(openrouterModelId)
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
  attachments?: Array<{ type: string; url: string; mimeType: string }>
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
      if (m.attachments && m.attachments.length > 0) {
        const parts: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = []
        if (m.content) {
          parts.push({ type: "text", text: m.content })
        }
        for (const att of m.attachments) {
          if (att.type === "image") {
            parts.push({ type: "image", image: new URL(att.url) })
          }
        }
        result.push({ role: "user", content: parts } as ModelMessage)
      } else {
        result.push({ role: "user", content: m.content } as ModelMessage)
      }
    }
  }

  return result
}

const TOOL_CALL_PATTERN = /^(?:entity|event|calendar|whatsapp|agent|airtable|email|web|payment)[._](?:create|get|query|update|delete|link|unlink|emit|list|freeBusy|send|sendTemplate|sendInteractive|sendMedia|listTemplates|getConversation|getStatus|chat|listBases|listTables|listRecords|getRecord|createRecords|updateRecords|deleteRecords|search|fetch)\b/i

export function cleanToolCallText(text: string): string {
  const lines = text.split("\n")
  const cleaned: string[] = []
  let inToolBlock = false
  let braceDepth = 0

  for (const line of lines) {
    const trimmed = line.trim()

    if (TOOL_CALL_PATTERN.test(trimmed)) {
      inToolBlock = true
      braceDepth = 0
      for (const ch of line) {
        if (ch === "{" || ch === "(") braceDepth++
        if (ch === "}" || ch === ")") braceDepth--
      }
      if (braceDepth <= 0) inToolBlock = false
      continue
    }

    if (inToolBlock) {
      for (const ch of line) {
        if (ch === "{" || ch === "(") braceDepth++
        if (ch === "}" || ch === ")") braceDepth--
      }
      if (braceDepth <= 0) inToolBlock = false
      continue
    }

    cleaned.push(line)
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim()
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
        content: "",
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
      const cleaned = cleanToolCallText(step.text)
      if (cleaned) {
        result.push({
          role: "assistant",
          content: cleaned,
        })
      }
    }
  }

  return result
}
