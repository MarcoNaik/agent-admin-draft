"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Calendar, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import {
  useCalendarConnection,
  useCalendarConnections,
  useConnectCalendar,
  useDisconnectCalendar,
  useSelectCalendar,
  useListUserCalendars,
  useVerifyCalendarConnection,
} from "@/hooks/use-convex-data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const connection = useCalendarConnection("production")
  const allConnections = useCalendarConnections("production")
  const connectCalendar = useConnectCalendar()
  const disconnectCalendar = useDisconnectCalendar()
  const selectCalendar = useSelectCalendar()
  const listUserCalendars = useListUserCalendars()
  const verifyConnection = useVerifyCalendarConnection()

  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null)
  const [calendars, setCalendars] = useState<Array<{ id: string; summary: string; primary: boolean }>>([])
  const [loadingCalendars, setLoadingCalendars] = useState(false)

  const status = connection?.status ?? "disconnected"

  useEffect(() => {
    if (status === "connected" && calendars.length === 0) {
      loadCalendars()
    }
  }, [status])

  const loadCalendars = async () => {
    setLoadingCalendars(true)
    try {
      const result = await listUserCalendars({ environment: "production" })
      setCalendars(result as Array<{ id: string; summary: string; primary: boolean }>)
    } catch (err) {
      console.error("Failed to load calendars:", err)
    } finally {
      setLoadingCalendars(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await connectCalendar({ environment: "production" })
      await loadCalendars()
    } catch (err) {
      console.error("Failed to connect:", err)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Google Calendar?")) return
    setDisconnecting(true)
    try {
      await disconnectCalendar({ environment: "production" })
      setCalendars([])
      setVerifyResult(null)
    } catch (err) {
      console.error("Failed to disconnect:", err)
    } finally {
      setDisconnecting(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setVerifyResult(null)
    try {
      const result = await verifyConnection({ environment: "production" })
      setVerifyResult(result)
    } catch (err) {
      setVerifyResult({ success: false, message: err instanceof Error ? err.message : "Verification failed" })
    } finally {
      setVerifying(false)
    }
  }

  const handleCalendarChange = async (calendarId: string) => {
    try {
      await selectCalendar({ environment: "production", calendarId })
    } catch (err) {
      console.error("Failed to select calendar:", err)
    }
  }

  if (connection === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

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
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-content-primary">Google Calendar</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-content-secondary mt-1">
            Connect Google Calendar to sync events and check availability
          </p>
        </div>
      </div>

      <Card className="mb-6 bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">Connection</CardTitle>
          <CardDescription className="text-content-secondary">
            {status === "connected"
              ? "Your Google Calendar is connected. Agents can create and manage events."
              : "Connect your Google account to enable calendar tools for agents."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "connected" && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10">
              <Calendar className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-content-primary">
                  Calendar: {connection?.calendarId === "primary" ? "Primary Calendar" : connection?.calendarId}
                </p>
                <p className="text-xs text-content-tertiary">
                  Connected {connection?.connectedAt ? new Date(connection.connectedAt).toLocaleString() : ""}
                </p>
              </div>
            </div>
          )}

          {status === "disconnected" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Calendar className="h-8 w-8 text-content-tertiary" />
              <p className="text-sm text-content-secondary">No Google Calendar connected</p>
              <p className="text-xs text-content-tertiary text-center max-w-sm">
                Sign in with Google OAuth via Clerk to grant calendar access, then connect here.
              </p>
            </div>
          )}

          {verifyResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${verifyResult.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {verifyResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {verifyResult.message}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {status === "disconnected" && (
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Google Calendar"
                )}
              </Button>
            )}
            {status === "connected" && (
              <>
                <Button variant="outline" onClick={handleVerify} disabled={verifying}>
                  {verifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Verify Connection
                    </>
                  )}
                </Button>
                <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {status === "connected" && (
        <Card className="mb-6 bg-background-secondary">
          <CardHeader>
            <CardTitle className="text-base text-content-primary">Calendar Selection</CardTitle>
            <CardDescription className="text-content-secondary">
              Choose which calendar agents will use for creating and reading events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-content-primary">Active Calendar</Label>
              {loadingCalendars ? (
                <div className="flex items-center gap-2 text-sm text-content-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading calendars...
                </div>
              ) : (
                <Select
                  value={connection?.calendarId ?? "primary"}
                  onValueChange={handleCalendarChange}
                >
                  <SelectTrigger className="bg-background-tertiary">
                    <SelectValue placeholder="Select a calendar" />
                  </SelectTrigger>
                  <SelectContent>
                    {calendars.map((cal) => (
                      <SelectItem key={cal.id} value={cal.id}>
                        {cal.summary}{cal.primary ? " (Primary)" : ""}
                      </SelectItem>
                    ))}
                    {calendars.length === 0 && (
                      <SelectItem value="primary">Primary Calendar</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-content-tertiary">
                Events created by agents will appear on this calendar
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
  )
}
