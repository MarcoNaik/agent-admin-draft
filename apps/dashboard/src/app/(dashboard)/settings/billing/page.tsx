"use client"

import { CreditCard, Check } from "lucide-react"
import { useCurrentOrganization } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "1 agent",
      "1,000 messages/month",
      "Community support",
      "Basic analytics",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    features: [
      "Unlimited agents",
      "50,000 messages/month",
      "Priority support",
      "Advanced analytics",
      "Custom integrations",
      "Team collaboration",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: [
      "Unlimited everything",
      "Dedicated support",
      "SLA guarantee",
      "Custom contracts",
      "On-premise option",
      "Advanced security",
    ],
  },
]

export default function BillingPage() {
  const organization = useCurrentOrganization()
  const currentPlan = organization?.plan || "free"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Billing</h1>
        <p className="text-sm text-content-secondary">Manage your subscription and payment methods</p>
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Current Plan</CardTitle>
          <CardDescription className="text-content-secondary">You are currently on the {currentPlan} plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="capitalize text-base px-3 py-1">
              {currentPlan}
            </Badge>
            {currentPlan === "free" && (
              <span className="text-sm text-content-secondary">
                Upgrade to unlock more features
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.name.toLowerCase() === currentPlan
          return (
            <Card key={plan.name} className={`bg-background-secondary ${isCurrent ? "border-primary" : ""}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-content-primary">{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <CardDescription>
                  <span className="text-2xl font-bold text-content-primary">{plan.price}</span>
                  <span className="text-content-secondary">{plan.period}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-content-secondary">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <Button variant={plan.name === "Pro" ? "default" : "outline"} className="w-full">
                    {plan.name === "Enterprise" ? "Contact Sales" : "Upgrade"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Payment Method</CardTitle>
          <CardDescription className="text-content-secondary">Manage your payment information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 border border-border/50 rounded-lg bg-background-tertiary">
            <CreditCard className="h-5 w-5 text-content-secondary" />
            <span className="text-sm text-content-secondary">No payment method on file</span>
          </div>
          <Button variant="outline" className="mt-4">
            Add Payment Method
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
