"use client"

import Link from "next/link"
import { MessageSquare, CreditCard, Video, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { useIntegrationConfigs, useWhatsAppConnection } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent } from "@/components/ui/card"
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
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-content-primary">{name}</h3>
              <p className="text-sm text-content-secondary mt-0.5">{description}</p>
            </div>
            {status && (
              <div className="shrink-0">
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
  const { environment } = useEnvironment()
  const whatsappConnection = useWhatsAppConnection(environment)

  const getStatus = (provider: string): "active" | "inactive" | "error" | null => {
    if (provider === "whatsapp") {
      if (whatsappConnection === undefined) return null
      if (whatsappConnection?.status === "connected") return "active"
      if (whatsappConnection?.status === "connecting" || whatsappConnection?.status === "qr_ready") return "inactive"
      return "inactive"
    }
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
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Integrations</h1>
        <p className="text-sm text-content-secondary mt-1">Connect external services to your platform</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-content-secondary">Communication</h2>
        <IntegrationCard
          name="WhatsApp"
          description="Connect your WhatsApp account for AI-powered conversations"
          href="/settings/integrations/whatsapp"
          icon={<MessageSquare className="h-5 w-5 text-primary" />}
          status={getStatus("whatsapp")}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-content-secondary">Payments</h2>
        <IntegrationCard
          name="Flow Payment"
          description="Accept payments from parents and guardians"
          href="/settings/integrations/payments"
          icon={<CreditCard className="h-5 w-5 text-primary" />}
          status={getStatus("flow")}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-content-secondary">Video Conferencing</h2>
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
