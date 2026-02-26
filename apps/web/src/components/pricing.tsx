"use client"

import { motion } from "motion/react"
import { useParallaxY, useScaleIn } from "@/hooks/use-scroll-animation"
import { useI18n } from "@/lib/i18n"

const models = [
  { name: "grok-4-1-fast", input: "$0.22", output: "$0.55", isDefault: true },
  { name: "gemini-2.5-flash", input: "$0.33", output: "$2.75", isDefault: false },
  { name: "claude-haiku-4.5", input: "$1.10", output: "$5.50", isDefault: false },
  { name: "gpt-4o", input: "$2.75", output: "$11.00", isDefault: false },
  { name: "claude-sonnet-4", input: "$3.30", output: "$16.50", isDefault: false },
]

export function Pricing() {
  const { t } = useI18n()
  const { ref: headingRef, y: headingY } = useParallaxY()
  const { ref, scale, opacity, y } = useScaleIn()

  return (
    <section id="precios" className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div ref={headingRef} className="text-center mb-12">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading"
            style={{ y: headingY, willChange: "transform" }}
          >
            {t.pricing.title}
          </motion.h2>
          <p className="mt-4 text-base text-charcoal/60 max-w-lg mx-auto">{t.pricing.subtitle}</p>
        </div>

        <motion.div
          ref={ref}
          style={{ scale, opacity, y, willChange: "transform, opacity" }}
          className="relative p-8 md:p-10 rounded-2xl bg-white/80 border border-ocean/15 shadow-lg shadow-ocean/5 mb-6"
        >
          <div className="absolute inset-0 rounded-2xl p-[1px] pointer-events-none">
            <div className="absolute inset-0 rounded-2xl prismatic-border opacity-20" />
          </div>

          <div className="relative md:flex md:items-start md:gap-10">
            <div className="flex-1 mb-8 md:mb-0">
              <span className="inline-block px-4 py-1 text-xs font-medium text-white bg-ocean rounded-full mb-5">
                {t.pricing.freeBadge}
              </span>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-display text-5xl font-semibold text-charcoal-heading">
                  {t.pricing.freePrice}
                </span>
              </div>
              <p className="text-sm text-charcoal/50 mb-6">{t.pricing.freePriceNote}</p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-6">
                {t.pricing.freeFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-ocean flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-sm text-charcoal/70">{feature}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-charcoal/50 leading-relaxed mb-6">{t.pricing.freeHow}</p>

              <a
                href="https://app.struere.dev"
                className="inline-block text-center text-sm font-medium py-3 px-8 rounded-xl bg-ocean text-white hover:bg-ocean-light transition-colors duration-200"
              >
                {t.pricing.freeCta}
              </a>
              <p className="mt-3 text-xs text-charcoal/40">{t.pricing.freeNote}</p>
            </div>

            <div className="hidden md:block w-px bg-charcoal/10 self-stretch" />

            <div className="flex-1 pt-6 md:pt-0 border-t md:border-t-0 border-charcoal/10">
              <h3 className="text-sm font-medium text-charcoal-heading mb-2">{t.pricing.managedTitle}</h3>
              <p className="text-xs text-charcoal/50 leading-relaxed mb-4">{t.pricing.managedNote}</p>

              <table className="w-full text-xs mb-3">
                <thead>
                  <tr className="border-b border-charcoal/10 text-charcoal/40">
                    <th className="text-left py-1.5 pr-2 font-medium">Model</th>
                    <th className="text-right py-1.5 px-2 font-medium">{t.pricing.tableInput}</th>
                    <th className="text-right py-1.5 pl-2 font-medium">{t.pricing.tableOutput}</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model, i) => (
                    <tr key={model.name} className={i < models.length - 1 ? "border-b border-charcoal/5" : ""}>
                      <td className="py-2 pr-2 text-charcoal-heading font-mono text-[11px]">
                        {model.name}
                        {model.isDefault && (
                          <span className="ml-1 px-1 py-0.5 text-[9px] font-sans font-medium text-ocean bg-ocean/10 rounded">
                            {t.pricing.tableDefault}
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 px-2 text-charcoal/50 font-mono text-[11px]">{model.input}</td>
                      <td className="text-right py-2 pl-2 text-charcoal/50 font-mono text-[11px]">{model.output}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-[11px] text-charcoal/40 leading-relaxed">{t.pricing.managedIncludes}</p>
              <p className="text-[11px] text-charcoal/30 mt-1">{t.pricing.tableFooter}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
