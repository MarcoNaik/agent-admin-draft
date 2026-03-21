const MARKUP = 1.1

interface ModelPricing {
  inputPerMTok: number
  outputPerMTok: number
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-haiku-4-5": { inputPerMTok: 1.0 * MARKUP, outputPerMTok: 5.0 * MARKUP },
  "claude-haiku-4.5": { inputPerMTok: 1.0 * MARKUP, outputPerMTok: 5.0 * MARKUP },
  "claude-sonnet-4": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "claude-sonnet-4-5": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "claude-sonnet-4.5": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "claude-sonnet-4-6": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "claude-opus-4": { inputPerMTok: 15.0 * MARKUP, outputPerMTok: 75.0 * MARKUP },
  "claude-opus-4-5": { inputPerMTok: 5.0 * MARKUP, outputPerMTok: 25.0 * MARKUP },
  "claude-opus-4.5": { inputPerMTok: 5.0 * MARKUP, outputPerMTok: 25.0 * MARKUP },
  "claude-opus-4-6": { inputPerMTok: 5.0 * MARKUP, outputPerMTok: 25.0 * MARKUP },
  "claude-opus-4.6": { inputPerMTok: 5.0 * MARKUP, outputPerMTok: 25.0 * MARKUP },

  "gpt-4o-mini": { inputPerMTok: 0.15 * MARKUP, outputPerMTok: 0.6 * MARKUP },
  "gpt-4o": { inputPerMTok: 2.5 * MARKUP, outputPerMTok: 10.0 * MARKUP },
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
  "o1-pro": { inputPerMTok: 150.0 * MARKUP, outputPerMTok: 600.0 * MARKUP },
  "o3": { inputPerMTok: 2.0 * MARKUP, outputPerMTok: 8.0 * MARKUP },
  "o3-mini": { inputPerMTok: 1.1 * MARKUP, outputPerMTok: 4.4 * MARKUP },
  "o3-pro": { inputPerMTok: 20.0 * MARKUP, outputPerMTok: 80.0 * MARKUP },
  "o4-mini": { inputPerMTok: 1.1 * MARKUP, outputPerMTok: 4.4 * MARKUP },

  "gemini-2.0-flash": { inputPerMTok: 0.1 * MARKUP, outputPerMTok: 0.4 * MARKUP },
  "gemini-2.5-flash": { inputPerMTok: 0.3 * MARKUP, outputPerMTok: 2.5 * MARKUP },
  "gemini-2.5-pro": { inputPerMTok: 1.25 * MARKUP, outputPerMTok: 10.0 * MARKUP },

  "grok-3": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "grok-3-mini": { inputPerMTok: 0.30 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-4-0709": { inputPerMTok: 3.0 * MARKUP, outputPerMTok: 15.0 * MARKUP },
  "grok-4-1-fast": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-4-1-fast-reasoning": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-4-1-fast-non-reasoning": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-4-fast-reasoning": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-4-fast-non-reasoning": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 0.50 * MARKUP },
  "grok-code-fast-1": { inputPerMTok: 0.20 * MARKUP, outputPerMTok: 1.50 * MARKUP },
}

const DEFAULT_PRICING: ModelPricing = MODEL_PRICING["grok-4-1-fast"]

function normalizeModelName(model: string): string {
  const slashIndex = model.indexOf("/")
  return slashIndex !== -1 ? model.slice(slashIndex + 1) : model
}

function resolvePricing(model: string): ModelPricing {
  const normalized = normalizeModelName(model)

  if (MODEL_PRICING[normalized]) return MODEL_PRICING[normalized]

  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (normalized.startsWith(key)) return pricing
  }

  return DEFAULT_PRICING
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = resolvePricing(model)
  const costUsd = (inputTokens * pricing.inputPerMTok + outputTokens * pricing.outputPerMTok) / 1_000_000
  return Math.round(costUsd * 1_000_000)
}

export function estimateMinimumCost(model: string): number {
  const pricing = resolvePricing(model)
  const costUsd = (1000 * pricing.inputPerMTok) / 1_000_000
  return Math.round(costUsd * 1_000_000)
}

export function estimateMaxCost(model: string): number {
  const pricing = resolvePricing(model)
  const costUsd = (10000 * pricing.inputPerMTok + 40960 * pricing.outputPerMTok) / 1_000_000
  return Math.round(costUsd * 1_000_000) * 10
}

export function estimateBatchCost(model: string): number {
  const pricing = resolvePricing(model)
  const costUsd = (4000 * pricing.inputPerMTok + 4096 * pricing.outputPerMTok) / 1_000_000
  return Math.round(costUsd * 1_000_000) * 2
}
