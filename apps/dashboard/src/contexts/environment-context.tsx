"use client"

import { createContext, useContext, useState, ReactNode } from "react"

type Environment = "development" | "production"

interface EnvironmentContextValue {
  environment: Environment
  setEnvironment: (env: Environment) => void
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null)

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironment] = useState<Environment>("development")

  return (
    <EnvironmentContext.Provider value={{ environment, setEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  )
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext)
  if (!context) {
    return { environment: "development" as Environment, setEnvironment: () => {} }
  }
  return context
}
