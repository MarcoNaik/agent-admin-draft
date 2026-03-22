export type ModelTier = "recommended" | "standard"

export interface StudioModel {
  id: string
  name: string
  provider: string
  tier: ModelTier
}

export const STUDIO_MODELS: StudioModel[] = [
  { id: "xai/grok-4", name: "Grok 4", provider: "xai", tier: "recommended" },
  { id: "xai/grok-4-1-fast", name: "Grok 4.1 Fast", provider: "xai", tier: "standard" },
  { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic", tier: "recommended" },
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic", tier: "standard" },
  { id: "openai/gpt-5.4-pro", name: "GPT-5.4 Pro", provider: "openai", tier: "recommended" },
  { id: "openai/gpt-5.4", name: "GPT-5.4", provider: "openai", tier: "standard" },
  { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", provider: "google", tier: "recommended" },
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", provider: "google", tier: "standard" },
]

export const DEFAULT_MODEL = "xai/grok-4-1-fast"
