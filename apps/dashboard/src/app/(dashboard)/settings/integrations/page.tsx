"use client"

import Link from "next/link"
import { MessageSquare, CreditCard, Video, Calendar, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { useIntegrationConfigs } from "@/hooks/use-convex-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface IntegrationCardProps {
  name: string
  description: string
  href: string
  icon: React.ReactNode
  status?: "active" | "inactive" | "error" | null
}

function IntegrationCard({ name, description, href, icon, status }: IntegrationCardProps) {
  return (
    <Link href={href}>
      <Card className="bg-background-secondary cursor-pointer hover:bg-background-tertiary transition-colors h-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {icon}
              </div>
              <div>
                <h3 className="font-medium text-content-primary">{name}</h3>
                <p className="text-sm text-content-secondary mt-1">{description}</p>
              </div>
            </div>
            {status && (
              <div>
                {status === "active" && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Connected
                  </Badge>
                )}
                {status === "inactive" && (
                  <Badge variant="outline">Not configured</Badge>
                )}
                {status === "error" && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Error
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function IntegrationsPage() {
  const configs = useIntegrationConfigs()

  const getStatus = (provider: string): "active" | "inactive" | "error" | null => {
    if (!configs) return null
    const config = configs.find((c: { provider: string }) => c.provider === provider)
    return config?.status || "inactive"
  }

  if (configs === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Integrations</h1>
          <p className="text-sm text-content-secondary">Connect external services to your platform</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Integrations</h1>
        <p className="text-sm text-content-secondary">Connect external services to your platform</p>
      </div>

      <div>
        <h2 className="text-lg font-medium text-content-primary mb-4">Communication</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <IntegrationCard
            name="WhatsApp Business"
            description="Send notifications and reminders via WhatsApp"
            href="/settings/integrations/whatsapp"
            icon={<MessageSquare className="h-5 w-5 text-primary" />}
            status={getStatus("whatsapp")}
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-content-primary mb-4">Payments</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <IntegrationCard
            name="Flow Payment"
            description="Accept payments from parents and guardians"
            href="/settings/integrations/payments"
            icon={<CreditCard className="h-5 w-5 text-primary" />}
            status={getStatus("flow")}
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-content-primary mb-4">Video Conferencing</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <IntegrationCard
            name="Google Meet"
            description="Create meeting links for tutoring sessions"
            href="/settings/integrations/google"
            icon={<Video className="h-5 w-5 text-primary" />}
            status={getStatus("google")}
          />
          <IntegrationCard
            name="Zoom"
            description="Create Zoom meetings for tutoring sessions"
            href="/settings/integrations/zoom"
            icon={<Video className="h-5 w-5 text-primary" />}
            status={getStatus("zoom")}
          />
        </div>
      </div>
    </div>
  )
}
