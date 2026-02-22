"use client"

import { useReveal } from "@/hooks/use-reveal"
import { useI18n } from "@/lib/i18n"

function UseCaseCard({
  useCase,
  index,
  ctaLabel,
}: {
  useCase: {
    icon: string
    title: string
    description: string
    prompt: string
  }
  index: number
  ctaLabel: string
}) {
  const { ref, isVisible } = useReveal({ threshold: 0.15, delay: index * 100 })

  return (
    <div
      ref={ref}
      className={`group relative p-6 md:p-8 rounded-2xl bg-white/50 backdrop-blur-sm border border-charcoal/5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-lg hover:shadow-ocean/5 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none p-[1px]">
        <div className="absolute inset-0 rounded-2xl prismatic-border-animated opacity-30" />
      </div>

      <div className="relative">
        <span className="text-3xl block mb-4">{useCase.icon}</span>
        <h3 className="font-display text-lg font-medium text-charcoal-heading mb-2">
          {useCase.title}
        </h3>
        <p className="text-sm text-charcoal/60 leading-relaxed mb-4">
          {useCase.description}
        </p>
        <p className="text-xs text-ocean/70 font-mono leading-relaxed italic">
          &ldquo;{useCase.prompt}&rdquo;
        </p>
        <a
          href="https://app.struere.dev"
          className="inline-block mt-5 text-xs font-medium text-ocean hover:text-ocean-light transition-colors"
        >
          {ctaLabel} &rarr;
        </a>
      </div>
    </div>
  )
}

export function UseCases() {
  const { t } = useI18n()
  const { ref, isVisible } = useReveal({ threshold: 0.2 })

  return (
    <section id="agentes" className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6 md:px-12">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            {t.useCases.title}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.useCases.cases.map((useCase, index) => (
            <UseCaseCard
              key={useCase.title}
              useCase={useCase}
              index={index}
              ctaLabel={t.useCases.createAgent}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
