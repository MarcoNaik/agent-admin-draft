"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { useCurrentUser } from "./use-users"

type Environment = "development" | "production"

export function useRoles(environment?: Environment) {
  return useQuery(api.roles.list, { environment })
}

export function useRole(id: Id<"roles">) {
  return useQuery(api.roles.get, { id })
}

export function useRoleWithPolicies(id: Id<"roles">) {
  return useQuery(api.roles.getWithPolicies, { id })
}

export function useCreateRole() {
  return useMutation(api.roles.create)
}

export function useUpdateRole() {
  return useMutation(api.roles.update)
}

export function useDeleteRole() {
  return useMutation(api.roles.remove)
}

export function useAddPolicy() {
  return useMutation(api.roles.addPolicy)
}

export function useRemovePolicy() {
  return useMutation(api.roles.removePolicy)
}

export function useAssignRoleToUser() {
  return useMutation(api.roles.assignToUser)
}

export function useRemoveRoleFromUser() {
  return useMutation(api.roles.removeFromUser)
}

export function useUserRoles(userId: Id<"users"> | undefined) {
  return useQuery(api.roles.getUserRoles, userId ? { userId } : "skip")
}

export function useCreatePendingAssignment() {
  return useMutation(api.roles.createPendingAssignment)
}

export function useRoleAssignedUsers(roleId: Id<"roles"> | undefined) {
  return useQuery(api.roles.getAssignedUsers, roleId ? { roleId } : "skip")
}

export function useCurrentUserRoles() {
  const currentUser = useCurrentUser()
  return useQuery(
    api.roles.getUserRoles,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  )
}
