"use client"

import { createContext, useContext, useCallback, useState, useEffect, useRef, ReactNode } from "react"
import { useSearchParams, useRouter } from "next/navigation"

interface StudioContextValue {
  isOpen: boolean
  toggleStudio: () => void
  openStudio: () => void
  closeStudio: () => void
  hasActiveSession: boolean
  setHasActiveSession: (active: boolean) => void
  initialPrompt: string | null
  consumeInitialPrompt: () => string | null
}

const STORAGE_KEY = "struere-studio-open"

function getStoredOpen(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(STORAGE_KEY) === "true"
}

const StudioContext = createContext<StudioContextValue | null>(null)

export function StudioProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(getStoredOpen)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)
  const paramConsumed = useRef(false)

  useEffect(() => {
    const stored = getStoredOpen()
    if (stored !== isOpen) {
      setIsOpen(stored)
    }
  }, [])

  useEffect(() => {
    if (paramConsumed.current) return
    const studioParam = searchParams.get("studio")
    if (studioParam === null) return

    paramConsumed.current = true
    persist(true)

    if (studioParam.trim()) {
      setInitialPrompt(studioParam.trim())
    }

    const url = new URL(window.location.href)
    url.searchParams.delete("studio")
    router.replace(url.pathname + url.search, { scroll: false })
  }, [searchParams])

  const persist = useCallback((open: boolean) => {
    setIsOpen(open)
    localStorage.setItem(STORAGE_KEY, String(open))
  }, [])

  const toggleStudio = useCallback(() => persist(!isOpen), [isOpen, persist])
  const openStudio = useCallback(() => persist(true), [persist])
  const closeStudio = useCallback(() => persist(false), [persist])

  const consumeInitialPrompt = useCallback(() => {
    const prompt = initialPrompt
    setInitialPrompt(null)
    return prompt
  }, [initialPrompt])

  return (
    <StudioContext.Provider value={{ isOpen, toggleStudio, openStudio, closeStudio, hasActiveSession, setHasActiveSession, initialPrompt, consumeInitialPrompt }}>
      {children}
    </StudioContext.Provider>
  )
}

export function useStudio() {
  const context = useContext(StudioContext)
  if (!context) {
    throw new Error("useStudio must be used within StudioProvider")
  }
  return context
}
