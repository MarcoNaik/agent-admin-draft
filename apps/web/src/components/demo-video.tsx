"use client"

import { motion } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

const VIDEO_URL =
  "https://zpnb1lrwswcma0nr.public.blob.vercel-storage.com/DemoVideov2.mp4"

export function DemoVideo() {
  const { ref, opacity, y } = useFadeSlideUp()

  return (
    <section className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <motion.div
          ref={ref}
          style={{ opacity, y, willChange: "transform, opacity" }}
        >
          <video
            className="aspect-video w-full rounded-2xl border border-charcoal/10"
            src={VIDEO_URL}
            controls
            preload="metadata"
            playsInline
          />
        </motion.div>
      </div>
    </section>
  )
}
