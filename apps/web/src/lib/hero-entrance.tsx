"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

interface HeroEntranceState {
  mounted: boolean
  loaded: boolean
  setImageLoaded: () => void
}

const HeroEntranceContext = createContext<HeroEntranceState>({
  mounted: false,
  loaded: false,
  setImageLoaded: () => {},
})

export function HeroEntranceProvider({ children }: { children: ReactNode }) {
  const [imageLoaded, setImageLoadedState] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)

  const setImageLoaded = useCallback(() => {
    setImageLoadedState(true)
  }, [])

  useEffect(() => {
    if (!imageLoaded) return

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setLoaded(true)
      setMounted(true)
      return
    }

    setLoaded(true)

    const timer = setTimeout(() => {
      requestAnimationFrame(() => setMounted(true))
    }, 150)

    return () => clearTimeout(timer)
  }, [imageLoaded])

  return (
    <HeroEntranceContext.Provider value={{ mounted, loaded, setImageLoaded }}>
      {children}
    </HeroEntranceContext.Provider>
  )
}

export function useHeroEntrance() {
  return useContext(HeroEntranceContext)
}
