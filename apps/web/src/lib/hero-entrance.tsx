"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

const HeroEntranceContext = createContext(false)

export function HeroEntranceProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setMounted(true)
      return
    }
    requestAnimationFrame(() => setMounted(true))
  }, [])

  return (
    <HeroEntranceContext.Provider value={mounted}>
      {children}
    </HeroEntranceContext.Provider>
  )
}

export function useHeroEntrance() {
  return useContext(HeroEntranceContext)
}
