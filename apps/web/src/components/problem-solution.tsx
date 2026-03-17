"use client"

import { motion } from "motion/react"
import { useParallaxY, useFadeSlideUp } from "@/hooks/use-scroll-animation"

function AnimatedBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const { ref, opacity, y } = useFadeSlideUp()

  return (
    <motion.div ref={ref} style={{ opacity, y, willChange: "transform, opacity" }} className={className}>
      {children}
    </motion.div>
  )
}

export function ProblemSolution() {
  const { ref, y } = useParallaxY(100)

  return (
    <section className="bg-stone-base py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div ref={ref} className="text-center mb-12">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading"
            style={{ y, willChange: "transform" }}
          >
            These tools were designed for humans.
          </motion.h2>
        </div>

        <AnimatedBlock className="text-center mb-20">
          <p className="text-base text-charcoal/60 leading-relaxed max-w-2xl mx-auto">
            Zapier, Make, n8n — they work. But they're built around drag-and-drop, flowcharts, and manual configuration. Every integration is a box you connect by hand.
          </p>
        </AnimatedBlock>

        <AnimatedBlock className="text-center py-12">
          <div className="mx-auto mb-8 h-[1px] w-16 md:w-20 prismatic-border rounded-full" />
          <h3 className="font-display text-2xl md:text-3xl font-medium text-charcoal-heading">
            AI is becoming the builder.
          </h3>
          <div className="mx-auto mt-8 h-[1px] w-16 md:w-20 prismatic-border rounded-full" />
        </AnimatedBlock>

        <AnimatedBlock className="text-center mb-20">
          <p className="text-base text-charcoal/60 leading-relaxed max-w-2xl mx-auto">
            Developers are using Claude Code to build entire applications by talking in English. But when it's time to create automations, there's no platform where AI can work natively.
          </p>
        </AnimatedBlock>

        <AnimatedBlock className="text-center">
          <h3 className="font-display text-xl md:text-2xl font-medium text-charcoal-heading mb-4">
            Struere is that platform.
          </h3>
          <p className="text-base text-charcoal/60 leading-relaxed max-w-lg mx-auto">
            A framework where AI defines agent prompts, creates tools, sets up databases, writes tests, and deploys — all from your description.
          </p>
        </AnimatedBlock>
      </div>
    </section>
  )
}
