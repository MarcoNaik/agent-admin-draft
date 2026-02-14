"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { ArrowLeft, Loader2, MessageSquare, Wifi, WifiOff, QrCode, Smartphone, RefreshCw } from "lucide-react"
import {
  useWhatsAppConnection,
  useConnectWhatsApp,
  useDisconnectWhatsApp,
  useReconnectWhatsApp,
  useSetWhatsAppAgent,
  useAgents,
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
          <Wifi className="h-3 w-3" />
          Connected
        </Badge>
      )
    case "qr_ready":
      return (
        <Badge className="flex items-center gap-1 bg-amber-500/20 text-amber-500 border-amber-500/30">
          <QrCode className="h-3 w-3" />
          Scan QR Code
        </Badge>
      )
    case "connecting":
      return (
        <Badge className="flex items-center gap-1 bg-blue-500/20 text-blue-500 border-blue-500/30">
          <Loader2 className="h-3 w-3 animate-spin" />
          Connecting
        </Badge>
      )
    default:
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <WifiOff className="h-3 w-3" />
          Disconnected
        </Badge>
      )
  }
}

export default function WhatsAppSettingsPage() {
  const router = useRouter()
  const connection = useWhatsAppConnection("production")
  const agents = useAgents()
  const connectWhatsApp = useConnectWhatsApp()
  const disconnectWhatsApp = useDisconnectWhatsApp()
  const reconnectWhatsApp = useReconnectWhatsApp()
  const setWhatsAppAgent = useSetWhatsAppAgent()

  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await connectWhatsApp({ environment: "production" })
    } catch (err) {
      console.error("Failed to connect:", err)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect WhatsApp?")) return
    setDisconnecting(true)
    try {
      await disconnectWhatsApp({ environment: "production" })
    } catch (err) {
      console.error("Failed to disconnect:", err)
    } finally {
      setDisconnecting(false)
    }
  }

  const handleReconnect = async () => {
    if (!confirm("This will reset your WhatsApp connection and require a new QR code scan. Continue?")) return
    setReconnecting(true)
    try {
      await reconnectWhatsApp({ environment: "production" })
    } catch (err) {
      console.error("Failed to reconnect:", err)
    } finally {
      setReconnecting(false)
    }
  }

  const handleAgentChange = async (value: string) => {
    try {
      await setWhatsAppAgent({
        agentId: value === "none" ? undefined : (value as any),
        environment: "production",
      })
    } catch (err) {
      console.error("Failed to set agent:", err)
    }
  }

  const status = connection?.status ?? "disconnected"

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
        <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-green-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-content-primary">WhatsApp</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-content-secondary mt-1">
            Connect your WhatsApp account to enable AI-powered conversations
          </p>
        </div>
      </div>

      <Card className="mb-6 bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">Connection</CardTitle>
          <CardDescription className="text-content-secondary">
            {status === "connected"
              ? "Your WhatsApp account is connected and ready to receive messages"
              : "Scan the QR code with your WhatsApp to connect"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "qr_ready" && connection?.qrCode && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG
                  value={connection.qrCode}
                  size={256}
                  level="M"
                />
              </div>
              <p className="text-sm text-content-secondary text-center max-w-sm">
                Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device, then scan this QR code
              </p>
            </div>
          )}

          {status === "connecting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-content-secondary">Connecting to WhatsApp...</p>
            </div>
          )}

          {status === "connected" && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10">
              <Smartphone className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-content-primary">
                  {connection?.phoneNumber ? `+${connection.phoneNumber}` : "Connected"}
                </p>
                <p className="text-xs text-content-tertiary">
                  {connection?.lastConnectedAt
                    ? `Connected since ${new Date(connection.lastConnectedAt).toLocaleString()}`
                    : "Active connection"}
                </p>
              </div>
            </div>
          )}

          {status === "disconnected" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <WifiOff className="h-8 w-8 text-content-tertiary" />
              <p className="text-sm text-content-secondary">No WhatsApp account connected</p>
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
                  "Connect WhatsApp"
                )}
              </Button>
            )}
            {status === "connected" && (
              <>
                <Button variant="outline" onClick={handleReconnect} disabled={reconnecting}>
                  {reconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reset Connection
                    </>
                  )}
                </Button>
                <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </>
            )}
            {status === "qr_ready" && (
              <Button variant="outline" onClick={handleConnect} disabled={connecting}>
                Refresh QR Code
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">Agent Configuration</CardTitle>
          <CardDescription className="text-content-secondary">
            Select which AI agent handles incoming WhatsApp messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-content-primary">Responding Agent</Label>
            <Select
              value={connection?.agentId ?? "none"}
              onValueChange={handleAgentChange}
            >
              <SelectTrigger className="bg-background-tertiary">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No agent (messages stored only)</SelectItem>
                {(agents ?? [])
                  .filter((a: any) => a.status === "active")
                  .map((agent: any) => (
                    <SelectItem key={agent._id} value={agent._id}>
                      {agent.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-content-tertiary">
              When an agent is selected, incoming WhatsApp messages will automatically be routed to the agent for a response
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
