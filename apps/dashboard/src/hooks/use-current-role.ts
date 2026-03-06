"use client"

import { useOrganization } from "@clerk/nextjs"
import { useCurrentUser } from "@/hooks/use-convex-data"
import { Id } from "@convex/_generated/dataModel"

export type UserRole = "admin" | "member"

interface CurrentRoleResult {
  isOrgAdmin: boolean
  role: UserRole
  isLoading: boolean
  userId: Id<"users"> | null
}

export function useCurrentRole(): CurrentRoleResult {
  const { membership } = useOrganization()
  const currentUser = useCurrentUser()

  const isOrgAdmin = membership?.role === "org:admin"

  if (currentUser === undefined) {
    return { isOrgAdmin, role: isOrgAdmin ? "admin" : "member", isLoading: true, userId: null }
  }

  if (currentUser === null) {
    return { isOrgAdmin, role: isOrgAdmin ? "admin" : "member", isLoading: false, userId: null }
  }

  const role: UserRole = isOrgAdmin ? "admin" : "member"

  return { isOrgAdmin, role, isLoading: false, userId: currentUser._id }
}
