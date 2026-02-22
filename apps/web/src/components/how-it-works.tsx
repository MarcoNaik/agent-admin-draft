"use client"

import { useReveal } from "@/hooks/use-reveal"
import { useI18n } from "@/lib/i18n"

function Step({
  step,
  index,
}: {
  step: { number: string; title: string; description: string }
  index: number
}) {
  const { ref, isVisible } = useReveal({ threshold: 0.2, delay: index * 150 })

  return (
    <div
      ref={ref}
      className={`relative py-16 md:py-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      }`}
    >
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
    </div>
  )
}

export function HowItWorks() {
  const { t } = useI18n()
  const { ref, isVisible } = useReveal({ threshold: 0.2 })

  return (
    <section id="como-funciona" className="bg-stone-base py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div
          ref={ref}
          className={`text-center mb-8 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            {t.howItWorks.title}
          </h2>
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
