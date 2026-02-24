const MARKUP = 1.1

interface ModelPricing {
  inputPerMTok: number
  outputPerMTok: number
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-3-haiku": { inputPerMTok: 0.25 * MARKUP, outputPerMTok: 1.25 * MARKUP },
  "claude-3.5-haiku": { inputPerMTok: 0.8 * MARKUP, outputPerMTok: 4.0 * MARKUP },
  "claude-haiku-4-5": { inputPerMTok: 1.0 * MARKUP, outputPerMTok: 5.0 * MARKUP },
  "claude-haiku-4.5": { inputPerMTok: 1.0 * MARKUP, outputPerMTok: 5.0 * MARKUP },
  "claude-3.5-sonnet": { inputPerMTok: 6.0 * MARKUP, outputPerMTok: 30.0 * MARKUP },
  "claude-sonnet-4-5": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "claude-sonnet-4.5": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "claude-sonnet-4": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "claude-sonnet-4-6": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "claude-3.7-sonnet": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "claude-opus-4-6": { inputPerMTok: 5.0 * MARKUP, outputPerMTok: 25.0 * MARKUP },
  "claude-opus-4.6": { inputPerMTok: 5.0 * MARKUP, outputPerMTok: 25.0 * MARKUP },
  "claude-opus-4-5": { inputPerMTok: 5.0 * MARKUP, outputPerMTok: 25.0 * MARKUP },
  "claude-opus-4.5": { inputPerMTok: 5.0 * MARKUP, outputPerMTok: 25.0 * MARKUP },
  "claude-opus-4.1": { inputPerMTok: 15.0 * MARKUP, outputPerMTok: 75.0 * MARKUP },
  "claude-opus-4": { inputPerMTok: 15.0 * MARKUP, outputPerMTok: 75.0 * MARKUP },

  "gpt-4o-mini": { inputPerMTok: 0.15 * MARKUP, outputPerMTok: 0.6 * MARKUP },
  "gpt-4o": { inputPerMTok: 2.5 * MARKUP, outputPerMTok: 10.0 * MARKUP },
  "gpt-4-turbo": { inputPerMTok: 10.0 * MARKUP, outputPerMTok: 30.0 * MARKUP },
  "gpt-4.1-nano": { inputPerMTok: 0.1 * MARKUP, outputPerMTok: 0.4 * MARKUP },
  "gpt-4.1-mini": { inputPerMTok: 0.4 * MARKUP, outputPerMTok: 1.6 * MARKUP },
  "gpt-4.1": { inputPerMTok: 2.0 * MARKUP, outputPerMTok: 8.0 * MARKUP },
  "gpt-5-nano": { inputPerMTok: 0.05 * MARKUP, outputPerMTok: 0.4 * MARKUP },
  "gpt-5-mini": { inputPerMTok: 0.25 * MARKUP, outputPerMTok: 2.0 * MARKUP },
  "gpt-5": { inputPerMTok: 1.25 * MARKUP, outputPerMTok: 10.0 * MARKUP },
  "gpt-5.1": { inputPerMTok: 1.25 * MARKUP, outputPerMTok: 10.0 * MARKUP },
  "gpt-5.2": { inputPerMTok: 1.75 * MARKUP, outputPerMTok: 14.0 * MARKUP },
  "o1": { inputPerMTok: 15.0 * MARKUP, outputPerMTok: 60.0 * MARKUP },
  "o1-mini": { inputPerMTok: 1.1 * MARKUP, outputPerMTok: 4.4 * MARKUP },
  "o3": { inputPerMTok: 2.0 * MARKUP, outputPerMTok: 8.0 * MARKUP },
  "o3-mini": { inputPerMTok: 1.1 * MARKUP, outputPerMTok: 4.4 * MARKUP },
  "o3-pro": { inputPerMTok: 20.0 * MARKUP, outputPerMTok: 80.0 * MARKUP },
  "o4-mini": { inputPerMTok: 1.1 * MARKUP, outputPerMTok: 4.4 * MARKUP },

  "gemini-1.5-flash": { inputPerMTok: 0.075 * MARKUP, outputPerMTok: 0.3 * MARKUP },
  "gemini-1.5-pro": { inputPerMTok: 1.25 * MARKUP, outputPerMTok: 5.0 * MARKUP },
  "gemini-2.0-flash": { inputPerMTok: 0.1 * MARKUP, outputPerMTok: 0.4 * MARKUP },
  "gemini-2.5-flash": { inputPerMTok: 0.3 * MARKUP, outputPerMTok: 2.5 * MARKUP },
  "gemini-2.5-pro": { inputPerMTok: 1.25 * MARKUP, outputPerMTok: 10.0 * MARKUP },
  "gemini-3-pro-preview": { inputPerMTok: 2.0 * MARKUP, outputPerMTok: 12.0 * MARKUP },

  "grok-3": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "grok-3-mini": { inputPerMTok: 0.30 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-4-0709": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "grok-4-1-fast-reasoning": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-4-1-fast-non-reasoning": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-4-fast-reasoning": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-4-fast-non-reasoning": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-code-fast-1": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 1.50 * MARKUP },
}

const DEFAULT_PRICING: ModelPricing = MODEL_PRICING["claude-sonnet-4"]

function resolvePricing(model: string): ModelPricing {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]

  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key)) return pricing
  }

  return DEFAULT_PRICING
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = resolvePricing(model)
  const costUsd = (inputTokens * pricing.inputPerMTok + outputTokens * pricing.outputPerMTok) / 1_000_000
  return Math.round(costUsd * 1_000_000)
}
