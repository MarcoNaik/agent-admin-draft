"use client"

import { motion } from "motion/react"
import { useParallaxY, useScaleIn } from "@/hooks/use-scroll-animation"
import { useI18n } from "@/lib/i18n"

export function EarlyAccess() {
  const { t } = useI18n()
  const { ref: headingRef, y: headingY } = useParallaxY()
  const { ref, scale, opacity, y } = useScaleIn()

  return (
    <section id="precios" className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-2xl px-6 md:px-12">
        <div ref={headingRef} className="text-center mb-12">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading"
            style={{ y: headingY, willChange: "transform" }}
          >
            {t.earlyAccess.title}
          </motion.h2>
          <p className="mt-4 text-base text-charcoal/60">
            {t.earlyAccess.subtitle}
          </p>
        </div>

        <motion.div
          ref={ref}
          style={{ scale, opacity, y, willChange: "transform, opacity" }}
          className="relative p-8 md:p-10 rounded-2xl bg-white/80 border border-ocean/15 shadow-lg shadow-ocean/5"
        >
          <div className="absolute inset-0 rounded-2xl p-[1px] pointer-events-none">
            <div className="absolute inset-0 rounded-2xl prismatic-border opacity-20" />
          </div>

          <div className="relative text-center">
            <span className="inline-block px-4 py-1 text-xs font-medium text-white bg-ocean rounded-full mb-6">
              {t.earlyAccess.badge}
            </span>

            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="font-display text-5xl font-semibold text-charcoal-heading">
                {t.earlyAccess.price}
              </span>
            </div>
            <p className="text-sm text-charcoal/50 mb-8">
              {t.earlyAccess.priceNote}
            </p>

            <div className="flex flex-col gap-3 mb-8 max-w-xs mx-auto">
              {t.earlyAccess.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <svg
                    className="w-4 h-4 text-ocean flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  <span className="text-sm text-charcoal/70">{feature}</span>
                </div>
              ))}
            </div>

            <a
              href="https://app.struere.dev?studio="
              className="inline-block w-full max-w-xs text-center text-sm font-medium py-3 rounded-xl bg-ocean text-white hover:bg-ocean-light transition-colors duration-200"
            >
              {t.earlyAccess.cta}
            </a>

            <p className="mt-4 text-xs text-charcoal/40">
              {t.earlyAccess.note}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
