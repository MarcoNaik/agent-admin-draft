"use client"

import { motion } from "motion/react"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"
import { useParallaxY, useFadeSlideUp } from "@/hooks/use-scroll-transforms"
import { useI18n } from "@/lib/i18n"

function Step({ step, index }: { step: { number: string; title: string; description: string }; index: number }) {
  const { ref, smoothProgress } = useScrollAnimation()
  const offset = index * 0.04
  const { opacity, y } = useFadeSlideUp(smoothProgress, {
    fadeRange: [0.12 + offset, 0.32 + offset],
    slideRange: [0.08 + offset, 0.36 + offset],
  })

  return (
    <motion.div ref={ref} style={{ opacity, y }} className="relative py-16 md:py-20">
      <span className="absolute top-8 md:top-12 left-0 font-display text-[120px] md:text-[140px] font-bold text-charcoal/[0.04] leading-none select-none pointer-events-none">
        {step.number}
      </span>
      <div className="relative max-w-xl">
        <h3 className="font-display text-2xl md:text-3xl font-medium text-charcoal-heading mb-4">
          {step.title}
        </h3>
        <p className="text-base md:text-lg text-charcoal/70 leading-relaxed max-w-lg">
          {step.description}
        </p>
        <div className="mt-8 h-[1px] w-16 md:w-20 prismatic-border rounded-full" />
      </div>
    </motion.div>
  )
}

export function HowItWorks() {
  const { t } = useI18n()
  const { ref, smoothProgress } = useScrollAnimation()
  const headingY = useParallaxY(smoothProgress, 200)

  return (
    <section id="como-funciona" className="bg-stone-base py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div ref={ref} className="text-center mb-8">
          <motion.h2
            className="font-display text-6xl md:text-8xl font-medium text-charcoal-heading"
            style={{ y: headingY }}
          >
            {t.howItWorks.title}
          </motion.h2>
        </div>

        <div className="divide-y divide-charcoal/5">
          {t.howItWorks.steps.map((step, index) => (
            <Step key={step.number} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
