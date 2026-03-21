export type ModelTier = "recommended" | "standard"

export interface StudioModel {
  id: string
  name: string
  tier: ModelTier
}

export interface StudioProviderConfig {
  name: string
  models: StudioModel[]
}

export type StudioProvider = "xai" | "anthropic" | "openai" | "google" | "openrouter"

export const STUDIO_PROVIDERS: Record<StudioProvider, StudioProviderConfig> = {
  xai: {
    name: "xAI",
    models: [
      { id: "grok-4", name: "Grok 4", tier: "recommended" },
      { id: "grok-4-1-fast", name: "Grok 4.1 Fast", tier: "standard" },
    ],
  },
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", tier: "recommended" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", tier: "standard" },
    ],
  },
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-5.4-pro", name: "GPT-5.4 Pro", tier: "recommended" },
      { id: "gpt-5.4", name: "GPT-5.4", tier: "standard" },
    ],
  },
  google: {
    name: "Google",
    models: [
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", tier: "recommended" },
      { id: "gemini-3-flash", name: "Gemini 3 Flash", tier: "standard" },
    ],
  },
  openrouter: {
    name: "OpenRouter",
    models: [
      { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", tier: "recommended" },
      { id: "openai/gpt-4o", name: "GPT-4o", tier: "standard" },
    ],
  },
}

export const DEFAULT_PROVIDER: StudioProvider = "anthropic"
export const DEFAULT_MODEL = "claude-sonnet-4-6"
