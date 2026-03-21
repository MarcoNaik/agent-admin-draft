import { v } from "convex/values"

export const PROVIDER_IDS = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "openrouter",
] as const

export type Provider = (typeof PROVIDER_IDS)[number]

export const providerValidator = v.union(
  v.literal("anthropic"),
  v.literal("openai"),
  v.literal("google"),
  v.literal("xai"),
  v.literal("openrouter")
)

export const PROVIDERS: {
  id: Provider
  name: string
  description: string
  color: string
  bgColor: string
  keyPrefix: string
  testEndpoint: string
}[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models for advanced reasoning",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    keyPrefix: "sk-ant-",
    testEndpoint: "https://api.anthropic.com/v1/messages",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT and o-series models",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    keyPrefix: "sk-",
    testEndpoint: "https://api.openai.com/v1/models",
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini models",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    keyPrefix: "AI",
    testEndpoint: "https://generativelanguage.googleapis.com/v1/models",
  },
  {
    id: "xai",
    name: "xAI",
    description: "Grok models for fast inference",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    keyPrefix: "xai-",
    testEndpoint: "https://api.x.ai/v1/models",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "400+ models via unified API",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    keyPrefix: "sk-or-",
    testEndpoint: "https://openrouter.ai/api/v1/models",
  },
]
