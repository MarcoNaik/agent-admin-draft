"use client"

import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"

export function useEnsureOrganization() {
  return useMutation(api.organizations.ensureOrganization)
}
