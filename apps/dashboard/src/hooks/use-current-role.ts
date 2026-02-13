"use client"

import { useOrganization } from "@clerk/nextjs"
import { useCurrentUser, useUserRoles } from "@/hooks/use-convex-data"
import { Id } from "@convex/_generated/dataModel"

export type PackRole = "teacher" | "guardian" | null
export type UserRole = "admin" | "teacher" | "guardian" | "member"

interface CurrentRoleResult {
  isOrgAdmin: boolean
  packRole: PackRole
  role: UserRole
  isLoading: boolean
  userId: Id<"users"> | null
}

export function useCurrentRole(): CurrentRoleResult {
  const { membership } = useOrganization()
  const currentUser = useCurrentUser()
  const userRoles = useUserRoles(currentUser?._id)

  const isOrgAdmin = membership?.role === "org:admin"

  if (currentUser === undefined) {
    return { isOrgAdmin, packRole: null, role: isOrgAdmin ? "admin" : "member", isLoading: true, userId: null }
  }

  if (currentUser === null) {
    return { isOrgAdmin, packRole: null, role: isOrgAdmin ? "admin" : "member", isLoading: false, userId: null }
  }

  if (userRoles === undefined) {
    return { isOrgAdmin, packRole: null, role: isOrgAdmin ? "admin" : "member", isLoading: true, userId: currentUser._id }
  }

  const roleName = userRoles[0]?.role?.name as string | undefined
  const packRole: PackRole = roleName === "teacher" || roleName === "guardian" ? roleName : null

  let role: UserRole = "member"
  if (isOrgAdmin) {
    role = "admin"
  } else if (packRole) {
    role = packRole
  }

  return { isOrgAdmin, packRole, role, isLoading: false, userId: currentUser._id }
}
