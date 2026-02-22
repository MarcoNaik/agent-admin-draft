"use client"

import { useReveal } from "@/hooks/use-reveal"

const steps = [
  {
    number: "01",
    title: "Describe",
    description: "Write what you need in plain words. \"Book appointments from WhatsApp and send confirmations.\" That's enough.",
  },
  {
    number: "02",
    title: "Connect",
    description: "Pick the integrations — WhatsApp, Calendar, payments. One click each.",
  },
  {
    number: "03",
    title: "Deploy",
    description: "Your agent goes live. Real conversations, real bookings. Watch it all from the dashboard.",
  },
]

function StepCard({
  step,
  index,
}: {
  step: (typeof steps)[0]
  index: number
}) {
  const { ref, isVisible } = useReveal({ threshold: 0.15, delay: index * 120 })

  return (
    <div
      ref={ref}
      className={`flex-1 p-6 rounded-xl bg-cream-card/50 border border-forest/8 transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <span className="text-[10px] font-medium tracking-wider text-forest-accent/40">
        {step.number}
      </span>
      <h3 className="text-sm font-medium tracking-wide text-forest mt-3 mb-2">
        {step.title}
      </h3>
      <p className="text-[11px] leading-[1.9] text-forest-accent/70">
        {step.description}
      </p>
    </div>
  )
}

export function HowItWorks() {
  const { ref, isVisible } = useReveal({ threshold: 0.2 })

  return (
    <section className="relative bg-cream-card py-28 md:py-36">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-[9px] tracking-[0.3em] uppercase text-forest-accent/50 mb-3">
            How it works
          </p>
          <h2 className="text-2xl md:text-3xl tracking-tight text-forest font-light">
            Three steps. That&apos;s it.
          </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          {steps.map((step, index) => (
            <StepCard key={step.number} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
