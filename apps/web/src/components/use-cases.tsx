"use client"

import { motion } from "motion/react"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"
import { useParallaxY, useScaleIn } from "@/hooks/use-scroll-transforms"
import { useI18n } from "@/lib/i18n"

function UseCaseCard({ useCase, index, ctaLabel }: {
  useCase: { icon: string; title: string; description: string; prompt: string }
  index: number
  ctaLabel: string
}) {
  const { ref, smoothProgress } = useScrollAnimation()
  const offset = index * 0.03
  const { scale, opacity, y } = useScaleIn(smoothProgress, {
    scaleRange: [0.12 + offset, 0.38 + offset],
  })

  return (
    <motion.div
      ref={ref}
      style={{ scale, opacity, y }}
      whileHover={{ y: -4 }}
      className="group relative p-6 md:p-8 rounded-2xl bg-white/50 backdrop-blur-sm border border-charcoal/5 shadow-none hover:shadow-lg hover:shadow-ocean/5"
    >
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none p-[1px]">
        <div className="absolute inset-0 rounded-2xl prismatic-border-animated opacity-30" />
      </div>

      <div className="relative">
        <span className="text-3xl block mb-4">{useCase.icon}</span>
        <h3 className="font-display text-lg font-medium text-charcoal-heading mb-2">{useCase.title}</h3>
        <p className="text-sm text-charcoal/60 leading-relaxed mb-4">{useCase.description}</p>
        <p className="text-xs text-ocean/70 font-mono leading-relaxed italic">&ldquo;{useCase.prompt}&rdquo;</p>
        <a
          href={`https://app.struere.dev?studio=${encodeURIComponent(useCase.prompt)}`}
          className="inline-block mt-5 text-xs font-medium text-ocean hover:text-ocean-light transition-colors"
        >
          {ctaLabel} &rarr;
        </a>
      </div>
    </motion.div>
  )
}

export function UseCases() {
  const { t } = useI18n()
  const { ref, smoothProgress } = useScrollAnimation()
  const headingY = useParallaxY(smoothProgress)

  return (
    <section id="agentes" className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6 md:px-12">
        <div ref={ref} className="text-center mb-16">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading"
            style={{ y: headingY }}
          >
            {t.useCases.title}
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.useCases.cases.map((useCase, index) => (
            <UseCaseCard key={useCase.title} useCase={useCase} index={index} ctaLabel={t.useCases.createAgent} />
          ))}
        </div>
      </div>
    </section>
  )
}
