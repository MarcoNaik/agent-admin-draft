"use client"

import { motion } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

export function DemoVideo() {
  const { ref, opacity, y } = useFadeSlideUp()

  return (
    <section className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <motion.div
          ref={ref}
          style={{ opacity, y, willChange: "transform, opacity" }}
        >
          <div className="aspect-video rounded-2xl bg-charcoal/5 border border-charcoal/10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-charcoal/20 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-charcoal/30 ml-1"
              >
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.14-6.86a1 1 0 0 0 0-1.72L9.5 4.28a1 1 0 0 0-1.5.86z" fill="currentColor" />
              </svg>
            </div>
            <span className="text-sm text-charcoal/40 mt-4">Demo coming soon</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
