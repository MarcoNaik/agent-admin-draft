"use client"

import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from "react"
import { useRoleContext } from "@/contexts/role-context"

export type Environment = "development" | "production"

interface EnvironmentContextValue {
  environment: Environment
  setEnvironment: (env: Environment) => void
}

const STORAGE_KEY = "struere-environment"

function getStoredEnvironment(): Environment {
  if (typeof window === "undefined") return "development"
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === "production" ? "production" : "development"
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null)

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironmentState] = useState<Environment>(getStoredEnvironment)
  const { isAdmin } = useRoleContext()

  useEffect(() => {
    const stored = getStoredEnvironment()
    if (stored !== environment) {
      setEnvironmentState(stored)
    }
  }, [])

  const setEnvironment = useCallback((env: Environment) => {
    setEnvironmentState(env)
    localStorage.setItem(STORAGE_KEY, env)
  }, [])

  const resolvedEnvironment: Environment = isAdmin ? environment : "production"

  return (
    <EnvironmentContext.Provider value={{ environment: resolvedEnvironment, setEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  )
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext)
  if (!context) {
    return { environment: "production" as Environment, setEnvironment: () => {} }
  }
  return context
}
