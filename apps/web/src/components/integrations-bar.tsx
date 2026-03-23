"use client"

import { motion } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

const integrations = [
  "WhatsApp",
  "Google Calendar",
  "Airtable",
  "Resend",
]

export function IntegrationsBar() {
  const { ref, opacity, y } = useFadeSlideUp()

  return (
    <section className="bg-stone-deep py-12">
      <motion.div
        ref={ref}
        style={{ opacity, y, willChange: "transform, opacity" }}
        className="mx-auto max-w-5xl px-6 md:px-12"
      >
        <p className="text-center text-xs uppercase tracking-widest text-charcoal/30 mb-6">
          Works with
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {integrations.map((name) => (
            <span
              key={name}
              className="text-sm text-charcoal/50 font-medium px-4 py-1.5 border border-charcoal/8 rounded-full"
            >
              {name}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
