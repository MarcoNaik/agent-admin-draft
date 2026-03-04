"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/_generated/api"

export function useUsers() {
  return useQuery(api.users.list, {})
}

export function useUpdateUser() {
  return useMutation(api.users.update)
}

export function useCurrentUser() {
  return useQuery(api.users.getCurrent, {})
}

export function useEnsureUser() {
  return useMutation(api.users.ensureUser)
}

export function useCurrentOrganization() {
  return useQuery(api.organizations.getCurrent, {})
}
