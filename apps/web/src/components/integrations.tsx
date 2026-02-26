"use client"

import { motion } from "motion/react"
import { useParallaxY, useFadeSlideUp } from "@/hooks/use-scroll-animation"
import { useI18n } from "@/lib/i18n"

const aiProviders = [
  { name: "GPT", label: "OpenAI" },
  { name: "Claude", label: "Anthropic" },
  { name: "Gemini", label: "Google" },
  { name: "Grok", label: "xAI" },
]

const available = [
  { icon: "\uD83D\uDCF1", name: "WhatsApp Business" },
  { icon: "\uD83D\uDCC5", name: "Google Calendar" },
]

export function Integrations() {
  const { t } = useI18n()
  const { ref: headingRef, y: headingY } = useParallaxY()
  const ai = useFadeSlideUp()
  const int = useFadeSlideUp()

  return (
    <section id="integraciones" className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div ref={headingRef} className="text-center mb-12">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading"
            style={{ y: headingY, willChange: "transform" }}
          >
            {t.integrations.title}
          </motion.h2>
        </div>

        <motion.div ref={ai.ref} style={{ opacity: ai.opacity, y: ai.y, willChange: "transform, opacity" }}>
          <p className="text-center text-xs font-medium uppercase tracking-widest text-charcoal/40 mb-4">
            {t.integrations.aiModelsLabel}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {aiProviders.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/50 border border-amber/20 text-sm text-charcoal hover:-translate-y-0.5 hover:shadow-sm transition-[transform,box-shadow] duration-300"
              >
                <span className="font-medium">{provider.name}</span>
                <span className="text-[10px] text-charcoal/40">{provider.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div ref={int.ref} style={{ opacity: int.opacity, y: int.y, willChange: "transform, opacity" }}>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {available.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/70 border border-ocean/15 text-sm text-charcoal hover:-translate-y-0.5 hover:shadow-sm transition-[transform,box-shadow] duration-300"
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
                <span className="ml-1 text-[10px] font-medium text-ocean/70 bg-ocean/5 px-2 py-0.5 rounded-full">
                  {t.integrations.available}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
