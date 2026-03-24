"use client"

import { motion } from "motion/react"
import { Check } from "lucide-react"
import { useParallaxY, useScaleIn } from "@/hooks/use-scroll-animation"

const features = [
  "Unlimited agents for any task",
  "WhatsApp Business with a real-time inbox",
  "Google Calendar \u2014 your agent books and manages appointments",
  "A database for your customers, orders, and products",
  "Agents that hand off to each other automatically",
  "Direct support from the founding team",
]

export function EarlyAccess() {
  const { ref: headingRef, y: headingY } = useParallaxY()
  const { ref, scale, opacity, y } = useScaleIn()

  return (
    <section id="pricing" className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-2xl px-6 md:px-12">
        <div ref={headingRef} className="text-center mb-12">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading"
            style={{ y: headingY, willChange: "transform" }}
          >
            Get in before everyone else.
          </motion.h2>
          <p className="mt-4 text-base text-charcoal/60">
            Everything you need to automate your business — free while we grow together.
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
              Early access
            </span>

            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="font-display text-5xl font-semibold text-charcoal-heading">
                Free
              </span>
            </div>
            <p className="text-sm text-charcoal/50 mb-8">
              during early access
            </p>

            <div className="flex flex-col gap-3 mb-8 max-w-xs mx-auto">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-ocean flex-shrink-0" strokeWidth={2} />
                  <span className="text-sm text-charcoal/70">{feature}</span>
                </div>
              ))}
            </div>

            <a
              href="https://app.struere.dev?studio="
              className="inline-block w-full max-w-xs text-center text-sm font-medium py-3 rounded-xl bg-ocean text-white hover:bg-ocean-light transition-colors duration-200"
            >
              Get early access
            </a>

            <p className="mt-4 text-xs text-charcoal/40">
              No credit card · Cancel anytime
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
