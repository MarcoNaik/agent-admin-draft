"use client"

import { createContext, useContext, ReactNode } from "react"
import { useCurrentRole, UserRole } from "@/hooks/use-current-role"
import { Id } from "@convex/_generated/dataModel"

interface RoleContextValue {
  role: UserRole
  isLoading: boolean
  userId: Id<"users"> | null
  isAdmin: boolean
  isTeacher: boolean
  isGuardian: boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const { role, isLoading, userId } = useCurrentRole()

  const value: RoleContextValue = {
    role,
    isLoading,
    userId,
    isAdmin: role === "admin",
    isTeacher: role === "teacher",
    isGuardian: role === "guardian",
  }

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRoleContext(): RoleContextValue {
  const context = useContext(RoleContext)
  if (!context) {
    return {
      role: "member",
      isLoading: true,
      userId: null,
      isAdmin: false,
      isTeacher: false,
      isGuardian: false,
    }
  }
  return context
}
