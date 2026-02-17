"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Calendar, CheckCircle, XCircle } from "lucide-react"
import { useCalendarConnections } from "@/hooks/use-convex-data"
import { CalendarConnectionCard } from "@/components/calendar-connection-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Connected
        </Badge>
      )
    case "error":
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      )
    default:
      return (
        <Badge variant="outline">Disconnected</Badge>
      )
  }
}

export default function GoogleCalendarSettingsPage() {
  const router = useRouter()
  const allConnections = useCalendarConnections("production")

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/settings/integrations")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Integrations
      </Button>

      <div className="flex items-start gap-4 mb-6">
        <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Calendar className="h-6 w-6 text-blue-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-content-primary">Google Calendar</h1>
          <p className="text-content-secondary mt-1">
            Connect Google Calendar to sync events and check availability
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <CalendarConnectionCard alwaysShow />

        {allConnections && allConnections.length > 0 && (
          <Card className="bg-background-secondary">
            <CardHeader>
              <CardTitle className="text-base text-content-primary">Organization Members</CardTitle>
              <CardDescription className="text-content-secondary">
                All connected Google Calendar accounts in this organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allConnections.map((conn: any) => (
                  <div key={conn._id} className="flex items-center justify-between p-3 rounded-lg bg-background-tertiary">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-content-primary">{conn.userName}</p>
                        {conn.userEmail && (
                          <p className="text-xs text-content-tertiary">{conn.userEmail}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-content-tertiary">
                        {conn.calendarId === "primary" ? "Primary" : conn.calendarId}
                      </span>
                      <StatusBadge status={conn.status} />
                      <span className="text-xs text-content-tertiary">
                        {conn.lastUsedAt ? new Date(conn.lastUsedAt).toLocaleDateString() : "Never used"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
