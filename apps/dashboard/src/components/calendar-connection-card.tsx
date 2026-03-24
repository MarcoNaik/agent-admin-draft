"use client"

import { useState, useEffect } from "react"
import { Loader2, Calendar, CheckCircle, XCircle, RefreshCw, ExternalLink } from "@/lib/icons"
import { useUser } from "@clerk/nextjs"
import {
  useCalendarConnection,
  useConnectCalendar,
  useDisconnectCalendar,
  useSelectCalendar,
  useListUserCalendars,
  useVerifyCalendarConnection,
  useIntegrationConfig,
} from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
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

export function CalendarConnectionCard({ alwaysShow = false }: { alwaysShow?: boolean } = {}) {
  const { user: clerkUser } = useUser()
  const { environment } = useEnvironment()
  const integrationConfig = useIntegrationConfig("google", environment)
  const connection = useCalendarConnection(environment)
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

  const googleAccount = clerkUser?.externalAccounts?.find(
    (account) => (account.provider as string) === "google" && account.verification?.status === "verified"
  )
  const hasGoogleOAuth = !!googleAccount

  const status = connection?.status ?? "disconnected"

  useEffect(() => {
    if (status === "connected" && calendars.length === 0) {
      loadCalendars()
    }
  }, [status])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("calendar_oauth") === "complete" && status === "disconnected" && hasGoogleOAuth) {
      const url = new URL(window.location.href)
      url.searchParams.delete("calendar_oauth")
      window.history.replaceState({}, "", url.toString())
      handleAutoConnect()
    }
  }, [status, hasGoogleOAuth])

  const handleAutoConnect = async () => {
    setConnecting(true)
    try {
      await connectCalendar({ environment })
      await loadCalendars()
    } catch (err) {
      console.error("Failed to auto-connect:", err)
    } finally {
      setConnecting(false)
    }
  }

  const loadCalendars = async () => {
    setLoadingCalendars(true)
    try {
      const result = await listUserCalendars({ environment })
      setCalendars(result as Array<{ id: string; summary: string; primary: boolean }>)
    } catch (err) {
      console.error("Failed to load calendars:", err)
    } finally {
      setLoadingCalendars(false)
    }
  }

  const buildRedirectUrl = () => {
    const url = new URL(window.location.href)
    url.searchParams.set("calendar_oauth", "complete")
    return url.toString()
  }

  const handleConnectCalendar = async () => {
    if (!clerkUser) return
    setConnecting(true)

    const googleAccount = clerkUser.externalAccounts.find(
      (account) => (account.provider as string) === "google"
    )

    if (googleAccount) {
      const reauth = await googleAccount.reauthorize({
        additionalScopes: [
          "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/calendar.freebusy",
        ],
        redirectUrl: buildRedirectUrl(),
      })
      if (reauth?.verification?.externalVerificationRedirectURL) {
        window.location.href = reauth.verification.externalVerificationRedirectURL.href
      }
    } else {
      const externalAccount = await clerkUser.createExternalAccount({
        strategy: "oauth_google",
        additionalScopes: [
          "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/calendar.freebusy",
        ],
        redirectUrl: buildRedirectUrl(),
      })
      const redirectUrl = externalAccount.verification?.externalVerificationRedirectURL
      if (redirectUrl) {
        window.location.href = redirectUrl.href
      }
    }
  }

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Google Calendar?")) return
    setDisconnecting(true)
    try {
      await disconnectCalendar({ environment })
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
      const result = await verifyConnection({ environment })
      setVerifyResult(result)
    } catch (err) {
      setVerifyResult({ success: false, message: err instanceof Error ? err.message : "Verification failed" })
    } finally {
      setVerifying(false)
    }
  }

  const handleCalendarChange = async (calendarId: string) => {
    try {
      await selectCalendar({ environment, calendarId })
    } catch (err) {
      console.error("Failed to select calendar:", err)
    }
  }

  if (!alwaysShow) {
    if (integrationConfig === undefined) return null
    if (!integrationConfig || integrationConfig.status !== "active") return null
  }

  if (connection === undefined) {
    return (
      <Card className="bg-background-secondary">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-content-secondary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-background-secondary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-ocean/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-ocean" />
              </div>
              <div>
                <CardTitle className="text-base text-content-primary">Google Calendar</CardTitle>
                <CardDescription className="text-content-secondary">
                  {status === "connected"
                    ? "Your calendar is connected. Agents can create and manage events."
                    : "Connect your Google account to enable calendar sync."}
                </CardDescription>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "connected" && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-ocean/10">
              <Calendar className="h-5 w-5 text-ocean" />
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
                Connect your Google Calendar to let agents manage your events. You will be redirected to Google to authorize access.
              </p>
            </div>
          )}

          {verifyResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${verifyResult.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              {verifyResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {verifyResult.message}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {status === "disconnected" && (
              <Button onClick={handleConnectCalendar} disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Connect Google Calendar
                  </>
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
        <Card className="bg-background-secondary">
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
    </>
  )
}
