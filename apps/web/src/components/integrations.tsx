"use client"

import { useReveal } from "@/hooks/use-reveal"
import { useI18n } from "@/lib/i18n"

const aiProviders = [
  { name: "GPT-4o", label: "OpenAI" },
  { name: "Claude", label: "Anthropic" },
  { name: "Gemini", label: "Google" },
  { name: "Grok", label: "xAI" },
]

const available = [
  { icon: "\uD83D\uDCF1", name: "WhatsApp Business" },
  { icon: "\uD83D\uDCC5", name: "Google Calendar" },
]

const comingSoon = [
  { icon: "\uD83D\uDCAC", name: "Slack" },
  { icon: "\uD83D\uDCCA", name: "Google Sheets" },
  { icon: "\uD83D\uDECD\uFE0F", name: "Shopify" },
  { icon: "\uD83D\uDCDD", name: "Notion" },
]

export function Integrations() {
  const { t } = useI18n()
  const { ref, isVisible } = useReveal({ threshold: 0.2 })

  return (
    <section id="integraciones" className="bg-stone-deep py-20 md:py-28">
      <div ref={ref} className="mx-auto max-w-4xl px-6 md:px-12">
        <div
          className={`text-center mb-12 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            {t.integrations.title}
          </h2>
        </div>

        <div
          className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] delay-200 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <p className="text-center text-xs font-medium uppercase tracking-widest text-charcoal/40 mb-4">
            {t.integrations.aiModelsLabel}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {aiProviders.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/50 border border-amber/20 text-sm text-charcoal hover:-translate-y-0.5 hover:shadow-sm transition-all duration-300"
              >
                <span className="font-medium">{provider.name}</span>
                <span className="text-[10px] text-charcoal/40">{provider.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {available.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/70 border border-ocean/15 text-sm text-charcoal hover:-translate-y-0.5 hover:shadow-sm transition-all duration-300"
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
                <span className="ml-1 text-[10px] font-medium text-ocean/70 bg-ocean/5 px-2 py-0.5 rounded-full">
                  {t.integrations.available}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {comingSoon.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/30 border border-charcoal/5 text-sm text-charcoal/40"
              >
                <span className="opacity-50">{item.icon}</span>
                <span>{item.name}</span>
                <span className="ml-1 text-[10px] font-medium text-charcoal/30 bg-charcoal/3 px-2 py-0.5 rounded-full">
                  {t.integrations.comingSoon}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p
          className={`text-center mt-8 text-sm text-charcoal/40 transition-all duration-700 delay-400 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {t.integrations.moreComingSoon}
        </p>
      </div>
    </section>
  )
}
