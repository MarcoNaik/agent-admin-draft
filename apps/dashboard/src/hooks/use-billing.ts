"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"

export function useCreditBalance() {
  return useQuery(api.billing.getBalance, {})
}

export function useCreditTransactions(limit?: number, cursor?: number) {
  return useQuery(api.billing.getTransactions, { limit, cursor })
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

export function useCostRollup(periodType: "day" | "month", period: string) {
  return useQuery(api.billing.getCostRollup, { periodType, period })
}

export function useCostTrend(periodType: "day" | "month", periods: string[]) {
  return useQuery(api.billing.getCostTrend, { periodType, periods })
}
