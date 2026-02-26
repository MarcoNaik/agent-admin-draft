"use client"

import { useRef } from "react"
import { useScroll, useTransform, type MotionValue } from "motion/react"

type Ref = React.RefObject<HTMLDivElement>

export function useParallaxY(distance: number = 80): { ref: Ref; y: MotionValue<number> } {
  const ref = useRef<HTMLDivElement>(null) as Ref
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], [-distance / 2, distance / 2])
  return { ref, y }
}

export function useFadeSlideUp(distance: number = 30): { ref: Ref; opacity: MotionValue<number>; y: MotionValue<number> } {
  const ref = useRef<HTMLDivElement>(null) as Ref
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const opacity = useTransform(scrollYProgress, [0, 0.35], [0, 1])
  const y = useTransform(scrollYProgress, [0, 0.35], [distance, 0])
  return { ref, opacity, y }
}

export function useScaleIn(): { ref: Ref; scale: MotionValue<number>; opacity: MotionValue<number>; y: MotionValue<number> } {
  const ref = useRef<HTMLDivElement>(null) as Ref
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const scale = useTransform(scrollYProgress, [0, 0.35], [0.95, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.35], [0, 1])
  const y = useTransform(scrollYProgress, [0, 0.35], [24, 0])
  return { ref, scale, opacity, y }
}

export function usePageParallax(): { scrollY: MotionValue<number> } {
  const { scrollY } = useScroll()
  return { scrollY }
}
