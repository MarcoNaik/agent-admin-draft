"use client"

import { motion } from "motion/react"
import { useParallaxY, useFadeSlideUp } from "@/hooks/use-scroll-animation"

const steps = [
  {
    number: "01",
    title: "Describe what you need",
    description:
      "Tell Claude what your client needs: \"I need a WhatsApp agent that handles bookings and checks the calendar.\" Plain English. No flowcharts.",
  },
  {
    number: "02",
    title: "AI builds the system",
    description:
      "Claude creates the agent, defines its tools, sets up the database, and writes tests. You review everything from the dashboard.",
  },
  {
    number: "03",
    title: "Deploy and monitor",
    description:
      "Push to WhatsApp, web, or API. See every conversation in real time. Step in when you want.",
  },
]

function Step({ step }: { step: { number: string; title: string; description: string } }) {
  const { ref, opacity, y } = useFadeSlideUp()

  return (
    <motion.div ref={ref} style={{ opacity, y, willChange: "transform, opacity" }} className="relative py-8 md:py-10">
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
  const { ref, y } = useParallaxY(200)

  return (
    <section id="how-it-works" className="bg-stone-base pt-4 pb-8 md:pt-6 md:pb-12">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div ref={ref} className="text-center mb-8">
          <motion.h2
            className="font-display text-6xl md:text-8xl font-medium text-charcoal-heading"
            style={{ y, willChange: "transform" }}
          >
            Live in minutes.
          </motion.h2>
        </div>

        <div className="divide-y divide-charcoal/5">
          {steps.map((step) => (
            <Step key={step.number} step={step} />
          ))}
        </div>
      </div>
    </section>
  )
}
