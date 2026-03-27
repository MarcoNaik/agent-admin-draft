import type { Metadata } from "next"
import { PricingContent } from "./pricing-content"

export const metadata: Metadata = {
  title: "Pricing — Struere",
  description: "Simple, transparent pricing for Struere's AI agent platform. Start free with your own API keys, or add credits as you scale.",
}

export default function PricingPage() {
  return <PricingContent />
}
