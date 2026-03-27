"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"

export function useCreditBalance() {
  return useQuery(api.billing.getBalance, {})
}

export function useCreditTransactions(limit?: number, cursor?: number) {
  return useQuery(api.billing.getTransactions, { limit, cursor })
}

export function useCreateCheckoutSession() {
  return useAction(api.polarApi.buyCredits)
}

export function useCostRollup(periodType: "day" | "month", period: string) {
  return useQuery(api.billing.getCostRollup, { periodType, period })
}

export function useCostTrend(periodType: "day" | "month", periods: string[]) {
  return useQuery(api.billing.getCostTrend, { periodType, periods })
}

export function useSubscription() {
  return useQuery(api.polarHelpers.getSubscription, {})
}

export function useCheckoutStarter() {
  return useAction(api.polarApi.checkoutStarter)
}

export function useCheckoutPro() {
  return useAction(api.polarApi.checkoutPro)
}

export function useCreateCustomerPortalSession() {
  return useAction(api.polarApi.generateCustomerPortalUrl)
}
