"use client"

import { useCurrentUser, useUserRoles } from "@/hooks/use-convex-data"
import { Id } from "@convex/_generated/dataModel"

export type UserRole = "admin" | "teacher" | "guardian" | "member"

interface CurrentRoleResult {
  role: UserRole
  isLoading: boolean
  userId: Id<"users"> | null
}

export function useCurrentRole(): CurrentRoleResult {
  const currentUser = useCurrentUser()
  const userRoles = useUserRoles(currentUser?._id)

  if (currentUser === undefined) {
    return { role: "member", isLoading: true, userId: null }
  }

  if (currentUser === null) {
    return { role: "member", isLoading: false, userId: null }
  }

  if (currentUser.role === "admin") {
    return { role: "admin", isLoading: false, userId: currentUser._id }
  }

  if (userRoles === undefined) {
    return { role: "member", isLoading: true, userId: currentUser._id }
  }

  const hasAdminRole = userRoles.some(
    (ur: { role?: { name?: string; isSystem?: boolean } }) => ur.role?.name === "admin" || ur.role?.isSystem
  )
  const hasTeacherRole = userRoles.some((ur: { role?: { name?: string } }) => ur.role?.name === "teacher")
  const hasGuardianRole = userRoles.some((ur: { role?: { name?: string } }) => ur.role?.name === "guardian")

  if (hasAdminRole) {
    return { role: "admin", isLoading: false, userId: currentUser._id }
  }
  if (hasTeacherRole) {
    return { role: "teacher", isLoading: false, userId: currentUser._id }
  }
  if (hasGuardianRole) {
    return { role: "guardian", isLoading: false, userId: currentUser._id }
  }

  return { role: "member", isLoading: false, userId: currentUser._id }
}
