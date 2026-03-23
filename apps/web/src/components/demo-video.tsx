"use client"

import { useRef, useEffect } from "react"
import { motion } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

const VIDEO_URL =
  "https://zpnb1lrwswcma0nr.public.blob.vercel-storage.com/DemoVideov2.mp4"

export function DemoVideo() {
  const { ref, opacity, y } = useFadeSlideUp()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play()
        } else {
          video.pause()
        }
      },
      { threshold: 0.4 }
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="demo" className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-charcoal-heading text-center mb-10">
          See it in action.
        </h2>
        <motion.div
          ref={ref}
          style={{ opacity, y, willChange: "transform, opacity" }}
        >
          <video
            ref={videoRef}
            className="aspect-video w-full rounded-2xl border border-charcoal/10"
            src={VIDEO_URL}
            controls
            muted
            preload="metadata"
            playsInline
          />
        </motion.div>
      </div>
    </section>
  )
}
