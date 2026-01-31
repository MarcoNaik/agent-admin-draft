"use client"

import { useMemo } from "react"
import { CreditCard, Loader2, CheckCircle, Clock } from "lucide-react"
import { useEntities } from "@/hooks/use-convex-data"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(amount)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function GuardianPaymentsPage() {
  const payments = useEntities("payment")

  const sortedPayments = useMemo(() => {
    if (!payments) return []
    return [...payments].sort((a, b) => b.createdAt - a.createdAt)
  }, [payments])

  const pendingPayments = sortedPayments.filter((p) => p.status === "pending")
  const completedPayments = sortedPayments.filter((p) => p.status === "completed")

  if (payments === undefined) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-content-primary mb-6">Payments</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Payments</h1>
        <p className="text-content-secondary">View your payment history</p>
      </div>

      {pendingPayments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-content-primary mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Payments
          </h2>
          <div className="space-y-3">
            {pendingPayments.map((payment) => {
              const amount = payment.data?.amount as number | undefined
              const description = payment.data?.description as string | undefined
              const dueDate = payment.data?.dueDate as number | undefined

              return (
                <Card key={payment._id} className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-content-primary">
                          {description || "Payment"}
                        </p>
                        {dueDate && (
                          <p className="text-sm text-content-secondary">
                            Due: {formatDate(dueDate)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg text-content-primary">
                          {amount ? formatCurrency(amount) : "-"}
                        </p>
                        <Badge variant="outline" className="text-amber-600">
                          Pending
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium text-content-primary mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Payment History
        </h2>
        {completedPayments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="mx-auto mb-4 h-12 w-12 text-content-tertiary" />
              <h3 className="text-lg font-medium text-content-primary">No payment history</h3>
              <p className="mt-1 text-content-secondary">
                Your completed payments will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {completedPayments.map((payment) => {
              const amount = payment.data?.amount as number | undefined
              const description = payment.data?.description as string | undefined
              const paidAt = payment.data?.paidAt as number | undefined

              return (
                <Card key={payment._id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-content-primary">
                          {description || "Payment"}
                        </p>
                        {paidAt && (
                          <p className="text-sm text-content-secondary">
                            Paid: {formatDate(paidAt)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg text-content-primary">
                          {amount ? formatCurrency(amount) : "-"}
                        </p>
                        <Badge variant="secondary" className="text-green-600">
                          Completed
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
