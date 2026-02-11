"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useRoleContext } from "@/contexts/role-context"
import { UserRole } from "@/hooks/use-current-role"

interface RoleRedirectProps {
  allowedRoles: UserRole[]
  redirectTo?: string
  children: React.ReactNode
}

const roleDefaultRoutes: Record<UserRole, string> = {
  admin: "/agents",
  teacher: "/teacher/sessions",
  guardian: "/guardian/sessions",
  member: "/conversations",
}

export function RoleRedirect({ allowedRoles, redirectTo, children }: RoleRedirectProps) {
  const router = useRouter()
  const { role, isLoading } = useRoleContext()

  useEffect(() => {
    if (isLoading) return
    if (!allowedRoles.includes(role)) {
      router.replace(redirectTo || roleDefaultRoutes[role])
    }
  }, [role, isLoading, allowedRoles, redirectTo, router])

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
      </div>
    )
  }

  return <>{children}</>
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  return (
    <RoleRedirect allowedRoles={["admin"]}>
      {children}
    </RoleRedirect>
  )
}

export function TeacherOnly({ children }: { children: React.ReactNode }) {
  return (
    <RoleRedirect allowedRoles={["teacher", "admin"]}>
      {children}
    </RoleRedirect>
  )
}

export function GuardianOnly({ children }: { children: React.ReactNode }) {
  return (
    <RoleRedirect allowedRoles={["guardian", "admin"]}>
      {children}
    </RoleRedirect>
  )
}
