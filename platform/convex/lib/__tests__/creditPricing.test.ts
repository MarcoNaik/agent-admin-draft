import { describe, expect, test } from "bun:test"
import { calculateCost, estimateMinimumCost } from "../creditPricing"

const MARKUP = 1.1

describe("calculateCost", () => {
  test("returns correct microdollars for known model", () => {
    const cost = calculateCost("grok-4-1-fast", 1000, 500)
    const expectedUsd = (1000 * 0.20 * MARKUP + 500 * 0.50 * MARKUP) / 1_000_000
    const expectedMicrodollars = Math.round(expectedUsd * 1_000_000)
    expect(cost).toBe(expectedMicrodollars)
  })

  test("uses prefix-match fallback for versioned model names", () => {
    const cost = calculateCost("claude-sonnet-4-5-20241022", 1000, 500)
    const expectedUsd = (1000 * 3.0 * MARKUP + 500 * 15.0 * MARKUP) / 1_000_000
    const expectedMicrodollars = Math.round(expectedUsd * 1_000_000)
    expect(cost).toBe(expectedMicrodollars)
  })

  test("falls back to default pricing for unknown model", () => {
    const unknownCost = calculateCost("totally-unknown-model", 1000, 500)
    const defaultCost = calculateCost("grok-4-1-fast", 1000, 500)
    expect(unknownCost).toBe(defaultCost)
  })

  test("returns 0 when both tokens are 0", () => {
    const cost = calculateCost("grok-4-1-fast", 0, 0)
    expect(cost).toBe(0)
  })

  test("handles output-only token usage", () => {
    const cost = calculateCost("grok-4-1-fast", 0, 1000)
    const expectedUsd = (1000 * 0.50 * MARKUP) / 1_000_000
    const expectedMicrodollars = Math.round(expectedUsd * 1_000_000)
    expect(cost).toBe(expectedMicrodollars)
  })

  test("handles input-only token usage", () => {
    const cost = calculateCost("grok-4-1-fast", 1000, 0)
    const expectedUsd = (1000 * 0.20 * MARKUP) / 1_000_000
    const expectedMicrodollars = Math.round(expectedUsd * 1_000_000)
    expect(cost).toBe(expectedMicrodollars)
  })
})

describe("estimateMinimumCost", () => {
  test("returns positive value for known model", () => {
    const cost = estimateMinimumCost("grok-4-1-fast")
    expect(cost).toBeGreaterThan(0)
  })

  test("returns same value for unknown model as default pricing", () => {
    const unknownCost = estimateMinimumCost("totally-unknown-model")
    const defaultCost = estimateMinimumCost("grok-4-1-fast")
    expect(unknownCost).toBe(defaultCost)
  })

  test("returns correct microdollars based on 1000 input tokens", () => {
    const cost = estimateMinimumCost("grok-4-1-fast")
    const expectedUsd = (1000 * 0.20 * MARKUP) / 1_000_000
    const expectedMicrodollars = Math.round(expectedUsd * 1_000_000)
    expect(cost).toBe(expectedMicrodollars)
  })

  test("more expensive model returns higher minimum cost", () => {
    const cheapCost = estimateMinimumCost("grok-4-1-fast")
    const expensiveCost = estimateMinimumCost("claude-opus-4")
    expect(expensiveCost).toBeGreaterThan(cheapCost)
  })
})
