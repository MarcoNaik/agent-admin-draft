"use client"

import { Loader2, Clock, CheckCircle2, XCircle, Ban } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export const statusConfig = {
  pending: { icon: Clock, color: "text-content-tertiary", badge: "outline" as const },
  running: { icon: Loader2, color: "text-primary", badge: "default" as const },
  completed: { icon: CheckCircle2, color: "text-success", badge: "success" as const },
  failed: { icon: XCircle, color: "text-destructive", badge: "destructive" as const },
  cancelled: { icon: Ban, color: "text-content-tertiary", badge: "secondary" as const },
}

export function RunStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <div className="flex items-center gap-2">
      <StatusIcon className={`h-4 w-4 ${config.color} ${status === "running" ? "animate-spin" : ""}`} />
      <Badge variant={config.badge} className="text-xs capitalize">
        {status}
      </Badge>
    </div>
  )
}
