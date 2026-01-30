"use client"

import { createContext, useContext, useCallback, ReactNode } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

type Environment = "development" | "production"

interface EnvironmentContextValue {
  environment: Environment
  setEnvironment: (env: Environment) => void
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null)

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const envParam = searchParams.get("env")
  const environment: Environment = envParam === "production" ? "production" : "development"

  const setEnvironment = useCallback((env: Environment) => {
    const params = new URLSearchParams(searchParams.toString())
    if (env === "development") {
      params.delete("env")
    } else {
      params.set("env", env)
    }
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname)
  }, [searchParams, router, pathname])

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
