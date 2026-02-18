"use client"

import { useState } from "react"
import { Doc } from "@convex/_generated/dataModel"
import { Loader2, Plus, DollarSign, Info } from "lucide-react"
import {
  useCreditBalance,
  useCreditTransactions,
  useAddCredits,
  useAdjustBalance,
} from "@/hooks/use-convex-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatRelativeTime } from "@/lib/format"

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function AddCreditsForm() {
  const addCredits = useAddCredits()
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cents = Math.round(parseFloat(amount) * 100)
    if (isNaN(cents) || cents <= 0) return
    setLoading(true)
    try {
      await addCredits({ amount: cents, description: description || undefined })
      setAmount("")
      setDescription("")
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
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50.00"
            className="w-32 pl-7 pr-3 py-1.5 bg-background-tertiary border rounded-md text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div className="space-y-1 flex-1">
        <label className="text-xs text-content-secondary">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Manual top-up"
          className="w-full px-3 py-1.5 bg-background-tertiary border rounded-md text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !amount}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Add Credits
      </button>
    </form>
  )
}

function TransactionBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    addition: "bg-emerald-500/10 text-emerald-400",
    deduction: "bg-red-500/10 text-red-400",
    adjustment: "bg-blue-500/10 text-blue-400",
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

  if (balance === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-content-primary">Billing</h1>
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
        <h1 className="text-lg font-semibold text-content-primary">Billing</h1>
        <p className="text-sm text-content-secondary">Credit balance and transaction history</p>
      </div>

      <Card className="bg-background-secondary">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-content-secondary">Credit Balance</CardTitle>
          <DollarSign className="h-4 w-4 text-content-tertiary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-content-primary">{formatCents(balance.balance)}</div>
          <p className="text-xs text-content-tertiary mt-1">
            Last updated {formatRelativeTime(balance.updatedAt)}
          </p>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-300/80">
          When your credit balance reaches $0, API requests using platform keys will stop working.
          Agents configured with custom provider API keys are not affected.
        </p>
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-content-primary">Add Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <AddCreditsForm />
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
                      <td className={`text-right py-2 px-4 font-medium ${tx.type === "deduction" ? "text-red-400" : "text-emerald-400"}`}>
                        {tx.type === "deduction" ? "-" : "+"}{formatCents(tx.amount)}
                      </td>
                      <td className="text-right py-2 px-4 text-content-primary">
                        {formatCents(tx.balanceAfter)}
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
