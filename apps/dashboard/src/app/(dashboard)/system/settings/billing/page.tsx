"use client"

import { useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Doc } from "@convex/_generated/dataModel"
import { Loader2, CheckCircle2, X, CreditCard } from "@/lib/icons"
import {
  useCreditBalance,
  useCreditTransactions,
  useCreateCheckoutSession,
  useSubscription,
  useCheckoutStarter,
  useCreateCustomerPortalSession,
} from "@/hooks/use-convex-data"
import { formatRelativeTime } from "@/lib/format"
import { toast } from "sonner"

function formatDollars(microdollars: number): string {
  return `$${(microdollars / 1_000_000).toFixed(2)}`
}

function UsageBar({ percentage }: { percentage: number }) {
  const clamped = Math.min(Math.max(percentage, 0), 100)
  const color = clamped > 95 ? "bg-red-500" : clamped > 80 ? "bg-amber-500" : "bg-primary"
  return (
    <div className="h-1.5 bg-background-tertiary rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

function formatResetDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `Resets ${date.toLocaleDateString("en-US", { weekday: "short" })} ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const showSuccess = searchParams.get("success") === "true"
  const subscription = useSubscription()
  const balance = useCreditBalance()
  const [successDismissed, setSuccessDismissed] = useState(false)

  return (
    <div className="space-y-10">
      {showSuccess && !successDismissed && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <p className="text-sm text-success flex-1">Payment successful!</p>
          <button onClick={() => setSuccessDismissed(true)} className="text-success hover:text-success/80 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <PlanSection subscription={subscription} />

      <div className="border-t border-border" />

      <UsageSection subscription={subscription} balance={balance} />

      <div className="border-t border-border" />

      <TransactionSection />
    </div>
  )
}

function PlanSection({ subscription }: { subscription: any }) {
  const createCheckout = useCheckoutStarter()
  const createPortalSession = useCreateCustomerPortalSession()
  const [loading, setLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  if (subscription === undefined) {
    return <SectionLoader />
  }

  const isActive = subscription && (subscription.status === "active" || subscription.status === "cancelling")

  if (!isActive) {
    return (
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wider text-content-tertiary mb-4">Plan</h2>
        <p className="text-xl font-semibold text-content-primary">No active plan</p>
        <p className="text-sm text-content-tertiary mt-1 mb-5">Subscribe to get weekly included credits.</p>
        <button
          onClick={async () => {
            setLoading(true)
            try {
              const result = await createCheckout({
                origin: window.location.origin,
                successUrl: `${window.location.origin}${window.location.pathname}?success=true`,
              })
              window.location.href = result.url
            } catch (err: any) {
              toast.error(err.message ?? "Failed to create checkout")
            } finally {
              setLoading(false)
            }
          }}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Loading..." : "Subscribe — $30/mo"}
        </button>
      </section>
    )
  }

  const planLabel = subscription.plan === "pro" ? "Pro" : "Starter"
  const planPrice = subscription.plan === "pro" ? "$129" : "$30"
  const nextBilling = new Date(subscription.currentPeriodEnd)
  const dateStr = nextBilling.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const isCancelling = subscription.status === "cancelling"

  const handleManage = async () => {
    setPortalLoading(true)
    try {
      const result = await createPortalSession({})
      window.open(result.url, "_blank")
    } catch (err: any) {
      toast.error(err.message ?? "Failed to open portal")
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-content-tertiary">Plan</h2>
        <button
          onClick={handleManage}
          disabled={portalLoading}
          className="text-xs text-content-tertiary hover:text-content-primary cursor-pointer disabled:opacity-50 underline underline-offset-2"
        >
          {portalLoading ? "Opening..." : "Manage"}
        </button>
      </div>
      <p className="text-xl font-semibold text-content-primary">
        {planLabel} <span className="text-content-tertiary font-normal text-base">{planPrice}/mo</span>
      </p>
      {isCancelling ? (
        <p className="text-sm text-amber-400 mt-1">Cancels {dateStr}</p>
      ) : (
        <p className="text-sm text-content-tertiary mt-1">Renews {dateStr}</p>
      )}
    </section>
  )
}

function UsageSection({ subscription, balance }: { subscription: any; balance: any }) {
  const createCheckout = useCreateCheckoutSession()
  const [loading, setLoading] = useState(false)
  const [creditAmount, setCreditAmount] = useState("25")

  if (balance === undefined) {
    return <SectionLoader />
  }

  const hasSubscription = subscription && (subscription.status === "active" || subscription.status === "cancelling")
  const weeklyTotal = balance.weeklyCreditsLimit
  const weeklyUsed = weeklyTotal - balance.subscriptionCredits
  const weeklyPercent = hasSubscription && weeklyTotal > 0
    ? Math.round((weeklyUsed / weeklyTotal) * 100)
    : 0
  const purchasedDollars = balance.purchasedCredits / 1_000_000

  const handleBuy = async () => {
    const dollars = parseFloat(creditAmount)
    if (isNaN(dollars) || dollars < 1) {
      toast.error("Minimum purchase is $1.00")
      return
    }
    setLoading(true)
    try {
      const result = await createCheckout({
        amount: Math.round(dollars * 100),
        successUrl: `${window.location.origin}${window.location.pathname}?success=true`,
      })
      window.location.href = result.url
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create checkout")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-content-tertiary">Usage</h2>
        <span className="text-xs text-content-tertiary">{formatRelativeTime(balance.updatedAt)}</span>
      </div>

      {hasSubscription && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-base font-medium text-content-primary">Weekly credits</p>
            <p className="text-sm tabular-nums text-content-secondary">
              {formatDollars(weeklyUsed)} <span className="text-content-tertiary">of {formatDollars(weeklyTotal)}</span>
            </p>
          </div>
          <UsageBar percentage={weeklyPercent} />
          <div className="flex items-center justify-between">
            {balance.weeklyCreditsResetAt && (
              <p className="text-xs text-content-tertiary">{formatResetDate(balance.weeklyCreditsResetAt)}</p>
            )}
            <p className="text-xs text-content-tertiary">{weeklyPercent}% used</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-medium text-content-primary">Extra credits</p>
          <p className="text-2xl font-semibold text-content-primary mt-0.5 tabular-nums">${purchasedDollars.toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-background-tertiary rounded-md border border-border px-2 py-1.5">
            <span className="text-xs text-content-tertiary">$</span>
            <input
              type="number"
              min="1"
              step="1"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="w-12 bg-transparent text-sm text-content-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <button
            onClick={handleBuy}
            disabled={loading || !creditAmount}
            className="px-3 py-1.5 bg-background-tertiary text-content-primary rounded-md text-sm font-medium hover:bg-background-tertiary/80 disabled:opacity-50 border border-border cursor-pointer"
          >
            {loading ? "..." : "Buy"}
          </button>
        </div>
      </div>
    </section>
  )
}

function TransactionSection() {
  const PAGE_SIZE = 20
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined])
  const currentCursor = cursors[cursors.length - 1]
  const result = useCreditTransactions(PAGE_SIZE, currentCursor)
  const page = cursors.length

  const transactions = result?.items

  return (
    <section>
      <h2 className="text-xs font-medium uppercase tracking-wider text-content-tertiary mb-4">Transactions</h2>

      {transactions === undefined ? (
        <SectionLoader />
      ) : transactions.length === 0 && page === 1 ? (
        <p className="text-sm text-content-tertiary py-4">No transactions yet</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-content-tertiary">Date</th>
                  <th className="text-right py-2 px-4 text-xs font-medium text-content-tertiary">Amount</th>
                  <th className="text-right py-2 px-4 text-xs font-medium text-content-tertiary">Balance</th>
                  <th className="text-left py-2 pl-4 text-xs font-medium text-content-tertiary">Description</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: Doc<"creditTransactions">) => {
                  const isDebit = tx.type === "deduction" || tx.type === "usage_sync"
                  return (
                    <tr key={tx._id} className="border-b border-border/20">
                      <td className="py-3 pr-4 text-sm text-content-secondary whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className={`text-right py-3 px-4 text-sm font-medium tabular-nums ${isDebit ? "text-red-400" : "text-green-400"}`}>
                        {isDebit ? "−" : "+"}{formatDollars(tx.amount)}
                      </td>
                      <td className="text-right py-3 px-4 text-sm text-content-tertiary tabular-nums">
                        {tx.balanceAfter !== undefined ? formatDollars(tx.balanceAfter) : "—"}
                      </td>
                      <td className="py-3 pl-4 text-sm text-content-tertiary truncate max-w-[250px]">
                        {tx.description}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {(page > 1 || result?.nextCursor) && (
            <div className="flex items-center justify-between pt-3 mt-1">
              <button
                onClick={() => setCursors((prev) => prev.slice(0, -1))}
                disabled={page === 1}
                className="text-xs text-content-tertiary hover:text-content-primary disabled:opacity-30 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs text-content-tertiary">Page {page}</span>
              <button
                onClick={() => result?.nextCursor && setCursors((prev) => [...prev, result.nextCursor])}
                disabled={!result?.nextCursor}
                className="text-xs text-content-tertiary hover:text-content-primary disabled:opacity-30 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="h-4 w-4 animate-spin text-content-tertiary" />
    </div>
  )
}
