export type ModelTier = "fast" | "standard" | "premium"

export interface StudioModel {
  id: string
  name: string
  tier: ModelTier
}

export interface StudioProviderConfig {
  name: string
  models: StudioModel[]
}

export type StudioProvider = "xai" | "anthropic" | "openai" | "google"

export const STUDIO_PROVIDERS: Record<StudioProvider, StudioProviderConfig> = {
  xai: {
    name: "xAI",
    models: [
      { id: "grok-code-fast-1", name: "Grok Code Fast", tier: "fast" },
      { id: "grok-4-1-fast", name: "Grok 4.1 Fast", tier: "fast" },
      { id: "grok-4-0709", name: "Grok 4", tier: "standard" },
      { id: "grok-3", name: "Grok 3", tier: "standard" },
    ],
  },
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", tier: "fast" },
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", tier: "standard" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", tier: "standard" },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", tier: "premium" },
    ],
  },
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", tier: "fast" },
      { id: "gpt-4.1", name: "GPT-4.1", tier: "standard" },
      { id: "gpt-5", name: "GPT-5", tier: "standard" },
      { id: "o3", name: "o3", tier: "premium" },
      { id: "o4-mini", name: "o4 Mini", tier: "fast" },
    ],
  },
  google: {
    name: "Google",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tier: "fast" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", tier: "standard" },
      { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", tier: "premium" },
    ],
  },
}

export const DEFAULT_PROVIDER: StudioProvider = "xai"
export const DEFAULT_MODEL = "grok-code-fast-1"
