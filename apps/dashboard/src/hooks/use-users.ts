"use client"

import { useState } from "react"
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

export function useRemoveUser() {
  const [isRemoving, setIsRemoving] = useState(false)

  const removeUser = async (clerkUserId: string) => {
    setIsRemoving(true)
    try {
      const res = await fetch("/api/organizations/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: clerkUserId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to remove user")
      }
      return true
    } finally {
      setIsRemoving(false)
    }
  }

  return { removeUser, isRemoving }
}
