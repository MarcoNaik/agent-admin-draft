"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useEnvironment } from "@/contexts/environment-context"
import { useRoleContext } from "@/contexts/role-context"

type Environment = "development" | "production"

interface EnvironmentGuardProps {
  allowedEnvironments: Environment[]
  redirectTo?: string
  children: React.ReactNode
}

export function EnvironmentGuard({ allowedEnvironments, redirectTo = "/settings", children }: EnvironmentGuardProps) {
  const router = useRouter()
  const { environment } = useEnvironment()
  const { isLoading } = useRoleContext()

  useEffect(() => {
    if (isLoading) return
    if (!allowedEnvironments.includes(environment)) {
      router.replace(redirectTo)
    }
  }, [environment, isLoading, allowedEnvironments, redirectTo, router])

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!allowedEnvironments.includes(environment)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  return <>{children}</>
}

export function ProductionOnly({ children, redirectTo }: { children: React.ReactNode; redirectTo?: string }) {
  return (
    <EnvironmentGuard allowedEnvironments={["production"]} redirectTo={redirectTo}>
      {children}
    </EnvironmentGuard>
  )
}
