"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"

export function useCreditBalance() {
  return useQuery(api.billing.getBalance, {})
}

export function useCreditTransactions(limit?: number) {
  return useQuery(api.billing.getTransactions, { limit })
}

export function useAddCredits() {
  return useMutation(api.billing.addCredits)
}

export function useAdjustBalance() {
  return useMutation(api.billing.adjustBalance)
}

export function useCreateCheckoutSession() {
  return useAction(api.billing.createCheckoutSession)
}
