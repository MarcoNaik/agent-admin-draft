"use client"

import { useRef, useState, useEffect } from "react"
import { motion } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

const YOUTUBE_ID = "UkSP2vYXVBs"

export function DemoVideo() {
  const { ref, opacity, y } = useFadeSlideUp()
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="demo" className="bg-stone-base py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <motion.div
          ref={ref}
          style={{ opacity, y, willChange: "transform, opacity" }}
        >
          <div
            ref={containerRef}
            className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-xl shadow-ocean/10"
          >
            {visible && (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&mute=1&rel=0&modestbranding=1&color=white&iv_load_policy=3&playsinline=1`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Struere Demo"
              />
            )}
          </div>
        </motion.div>
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-charcoal-heading text-center mt-10">
          See it in action.
        </h2>
      </div>
    </section>
  )
}
