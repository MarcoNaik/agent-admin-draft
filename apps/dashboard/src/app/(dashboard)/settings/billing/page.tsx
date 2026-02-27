"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Doc } from "@convex/_generated/dataModel"
import Link from "next/link"
import { Loader2, CreditCard, DollarSign, CheckCircle2, X, Bot, Monitor, FlaskConical } from "lucide-react"
import {
  useCreditBalance,
  useCreditTransactions,
  useCreateCheckoutSession,
} from "@/hooks/use-convex-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatRelativeTime } from "@/lib/format"

function FormattedCredits({ microdollars, prefix }: { microdollars: number; prefix?: string }) {
  const dollars = microdollars / 1_000_000
  const formatted = dollars.toFixed(6)
  const bright = formatted.slice(0, -4)
  const dim = formatted.slice(-4)

  return (
    <>
      {prefix}${bright}<span className="opacity-40">{dim}</span>
    </>
  )
}

function PurchaseCreditsForm() {
  const createCheckout = useCreateCheckoutSession()
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cents = Math.round(parseFloat(amount) * 100)
    if (isNaN(cents) || cents < 100) return
    setLoading(true)
    try {
      const result = await createCheckout({
        amount: cents,
        successUrl: `${window.location.origin}${window.location.pathname}?success=true`,
      })
      window.location.href = result.checkoutUrl
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs text-content-secondary">Amount (USD)</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-content-tertiary">$</span>
          <input
            type="number"
            step="0.01"
            min="1.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10.00"
            className="w-32 pl-7 pr-3 py-1.5 font-input bg-background-tertiary border rounded-md text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !amount || parseFloat(amount) < 1}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
        Buy Credits
      </button>
    </form>
  )
}

function SuccessBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/30">
      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
      <p className="text-sm text-success flex-1">
        Payment successful! Your credits have been added to your balance.
      </p>
      <button onClick={() => setDismissed(true)} className="text-success hover:text-success/80">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function TransactionBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    addition: "bg-success/10 text-success",
    deduction: "bg-destructive/10 text-destructive",
    adjustment: "bg-ocean/10 text-ocean",
    purchase: "bg-violet-500/10 text-violet-400",
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${styles[type] ?? "bg-background-tertiary text-content-secondary"}`}>
      {type}
    </span>
  )
}

export default function BillingPage() {
  const balance = useCreditBalance()
  const transactions = useCreditTransactions(100)
  const searchParams = useSearchParams()
  const showSuccess = searchParams.get("success") === "true"

  if (balance === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-display font-semibold text-content-primary">Billing</h1>
          <p className="text-sm text-content-secondary">Credit balance and transaction history</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-display font-semibold text-content-primary">Billing</h1>
        <p className="text-sm text-content-secondary">Credit balance and transaction history</p>
      </div>

      {showSuccess && <SuccessBanner />}

      <Card className="bg-background-secondary">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-content-secondary">Credit Balance</CardTitle>
          <DollarSign className="h-4 w-4 text-content-tertiary" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-3xl font-bold text-content-primary"><FormattedCredits microdollars={balance.balance} /></div>
            <p className="text-xs text-content-tertiary mt-1">
              Last updated {formatRelativeTime(balance.updatedAt)}
            </p>
          </div>
          <div className="pt-3 border-t">
            <PurchaseCreditsForm />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-content-primary">How Billing Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-content-secondary">
            Per-token billing at provider rates + 10% markup. Skip the markup by adding your own keys in{" "}
            <Link href="/settings/providers" className="underline text-content-primary hover:text-primary">Providers</Link> or
            using <code className="text-xs bg-background-tertiary px-1 py-0.5 rounded">struere</code> CLI locally with your own API keys.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex gap-3 p-3 rounded-lg bg-background-tertiary">
              <Bot className="h-4 w-4 text-content-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-content-primary">Deployed Agents</p>
                <p className="text-xs text-content-secondary mt-0.5">API and webhook-triggered chats.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-lg bg-background-tertiary">
              <Monitor className="h-4 w-4 text-content-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-content-primary">Studio</p>
                <p className="text-xs text-content-secondary mt-0.5">Each prompt billed per token (grok-4-1-fast).</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-lg bg-background-tertiary">
              <FlaskConical className="h-4 w-4 text-content-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-content-primary">Evals</p>
                <p className="text-xs text-content-secondary mt-0.5">Agent + judge model tokens.</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-content-secondary mb-2">Pricing per 1M tokens (incl. 10% markup)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-content-tertiary">
                    <th className="text-left py-1.5 pr-4 font-medium">Model</th>
                    <th className="text-right py-1.5 px-4 font-medium">Input</th>
                    <th className="text-right py-1.5 pl-4 font-medium">Output</th>
                  </tr>
                </thead>
                <tbody className="text-content-secondary">
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 pr-4 text-content-primary">grok-4-1-fast</td>
                    <td className="text-right py-1.5 px-4">$0.22</td>
                    <td className="text-right py-1.5 pl-4">$0.55</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 pr-4 text-content-primary">claude-sonnet-4</td>
                    <td className="text-right py-1.5 px-4">$3.30</td>
                    <td className="text-right py-1.5 pl-4">$16.50</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 pr-4 text-content-primary">claude-haiku-4.5</td>
                    <td className="text-right py-1.5 px-4">$1.10</td>
                    <td className="text-right py-1.5 pl-4">$5.50</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 pr-4 text-content-primary">gpt-4o</td>
                    <td className="text-right py-1.5 px-4">$2.75</td>
                    <td className="text-right py-1.5 pl-4">$11.00</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-4 text-content-primary">gemini-2.5-flash</td>
                    <td className="text-right py-1.5 px-4">$0.33</td>
                    <td className="text-right py-1.5 pl-4">$2.75</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-content-tertiary mt-2">
              40+ models supported. See <Link href="/settings/usage" className="underline hover:text-content-secondary">Usage</Link> for per-model breakdowns.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-content-primary">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-content-secondary" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-content-secondary py-4 text-center">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-content-secondary">
                    <th className="text-left py-2 pr-4 font-medium">Date</th>
                    <th className="text-left py-2 px-4 font-medium">Type</th>
                    <th className="text-right py-2 px-4 font-medium">Amount</th>
                    <th className="text-right py-2 px-4 font-medium">Balance</th>
                    <th className="text-left py-2 pl-4 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: Doc<"creditTransactions">) => (
                    <tr key={tx._id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-content-secondary whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-4">
                        <TransactionBadge type={tx.type} />
                      </td>
                      <td className={`text-right py-2 px-4 font-medium ${tx.type === "deduction" ? "text-destructive" : "text-success"}`}>
                        <FormattedCredits microdollars={tx.amount} prefix={tx.type === "deduction" ? "-" : "+"} />
                      </td>
                      <td className="text-right py-2 px-4 text-content-primary">
                        {tx.balanceAfter !== undefined ? <FormattedCredits microdollars={tx.balanceAfter} /> : "—"}
                      </td>
                      <td className="py-2 pl-4 text-content-secondary truncate max-w-[200px]">
                        {tx.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
