"use client"

import { createContext, useContext, ReactNode } from "react"
import { useCurrentRole, UserRole } from "@/hooks/use-current-role"
import { Id } from "@convex/_generated/dataModel"

interface RoleContextValue {
  role: UserRole
  isLoading: boolean
  userId: Id<"users"> | null
  isOrgAdmin: boolean
  isAdmin: boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const { role, isOrgAdmin, isLoading, userId } = useCurrentRole()

  const value: RoleContextValue = {
    role,
    isLoading,
    userId,
    isOrgAdmin,
    isAdmin: isOrgAdmin,
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
      isOrgAdmin: false,
      isAdmin: false,
    }
  }
  return context
}
