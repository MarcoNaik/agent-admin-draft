"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { ArrowLeft, Loader2, MessageSquare, Wifi, WifiOff, QrCode, Smartphone, RefreshCw, Power, PowerOff, Hash, AlertCircle } from "lucide-react"
import {
  useWhatsAppConnection,
  useConnectWhatsApp,
  useDisconnectWhatsApp,
  useReconnectWhatsApp,
  useSetWhatsAppAgent,
  useAgents,
  useIntegrationConfig,
  useEnableWhatsApp,
  useDisableWhatsApp,
} from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
    case "pairing_code_ready":
      return (
        <Badge className="flex items-center gap-1 bg-amber-500/20 text-amber-500 border-amber-500/30">
          <Loader2 className="h-3 w-3 animate-spin" />
          Awaiting Link
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
  const { environment } = useEnvironment()
  const connection = useWhatsAppConnection(environment)
  const agents = useAgents()
  const connectWhatsApp = useConnectWhatsApp()
  const disconnectWhatsApp = useDisconnectWhatsApp()
  const reconnectWhatsApp = useReconnectWhatsApp()
  const setWhatsAppAgent = useSetWhatsAppAgent()
  const integrationConfig = useIntegrationConfig("whatsapp", environment)
  const enableWhatsApp = useEnableWhatsApp()
  const disableWhatsApp = useDisableWhatsApp()

  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("qr")
  const [pairingPhoneNumber, setPairingPhoneNumber] = useState("")

  const status = connection?.status ?? "disconnected"

  useEffect(() => {
    if (status === "qr_ready") setActiveTab("qr")
    if (status === "pairing_code_ready") setActiveTab("pairing_code")
  }, [status])

  const isEnabled = integrationConfig?.status === "active"
  const isWaitingForLink = status === "qr_ready" || status === "pairing_code_ready"
  const needsConnection = status === "disconnected" || isWaitingForLink

  const handleEnable = async () => {
    setToggling(true)
    setError(null)
    try {
      await enableWhatsApp({ environment })
    } catch (err) {
      setError("Failed to enable WhatsApp integration")
    } finally {
      setToggling(false)
    }
  }

  const handleDisable = async () => {
    if (!confirm("Are you sure you want to disable the WhatsApp integration?")) return
    setToggling(true)
    setError(null)
    try {
      await disableWhatsApp({ environment })
    } catch (err) {
      setError("Failed to disable WhatsApp integration")
    } finally {
      setToggling(false)
    }
  }

  const handleConnect = async (method: "qr" | "pairing_code") => {
    setConnecting(true)
    setError(null)
    try {
      await connectWhatsApp({
        environment,
        method,
        phoneNumber: method === "pairing_code" ? pairingPhoneNumber.replace(/\D/g, "") : undefined,
      })
    } catch (err) {
      setError(method === "qr" ? "Failed to generate QR code" : "Failed to generate pairing code")
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect WhatsApp?")) return
    setDisconnecting(true)
    setError(null)
    try {
      await disconnectWhatsApp({ environment })
    } catch (err) {
      setError("Failed to disconnect WhatsApp")
    } finally {
      setDisconnecting(false)
    }
  }

  const handleReconnect = async () => {
    if (!confirm("This will reset your WhatsApp connection and require re-linking. Continue?")) return
    setReconnecting(true)
    setError(null)
    try {
      await reconnectWhatsApp({ environment })
    } catch (err) {
      setError("Failed to reset connection")
    } finally {
      setReconnecting(false)
    }
  }

  const handleAgentChange = async (value: string) => {
    setError(null)
    try {
      await setWhatsAppAgent({
        agentId: value === "none" ? undefined : (value as any),
        environment,
      })
    } catch (err) {
      setError("Failed to update agent assignment")
    }
  }

  if (integrationConfig === undefined) {
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
            {isEnabled && <StatusBadge status={status} />}
          </div>
          <p className="text-content-secondary mt-1">
            Connect your WhatsApp account to enable AI-powered conversations
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <Card className="mb-6 bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">Integration Status</CardTitle>
          <CardDescription className="text-content-secondary">
            {isEnabled
              ? "WhatsApp integration is enabled for your organization"
              : "Enable the WhatsApp integration to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEnabled ? (
                <>
                  <Power className="h-4 w-4 text-green-500" />
                  <Badge variant="secondary">Enabled</Badge>
                </>
              ) : (
                <>
                  <PowerOff className="h-4 w-4 text-content-tertiary" />
                  <span className="text-sm text-content-secondary">Not enabled</span>
                </>
              )}
            </div>
            {isEnabled ? (
              <Button variant="outline" size="sm" onClick={handleDisable} disabled={toggling}>
                {toggling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disabling...
                  </>
                ) : (
                  "Disable"
                )}
              </Button>
            ) : (
              <Button size="sm" onClick={handleEnable} disabled={toggling}>
                {toggling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  "Enable WhatsApp"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isEnabled ? (
        <>
          <Card className="mb-6 bg-background-secondary">
            <CardHeader>
              <CardTitle className="text-base text-content-primary">Connection</CardTitle>
              <CardDescription className="text-content-secondary">
                {status === "connected"
                  ? "Your WhatsApp account is connected and ready to receive messages"
                  : "Choose a method to link your WhatsApp account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status === "connecting" && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-sm text-content-secondary">Connecting to WhatsApp...</p>
                </div>
              )}

              {status === "connected" && (
                <div className="space-y-4">
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
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReconnect} disabled={reconnecting}>
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
                    <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                      {disconnecting ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                </div>
              )}

              {needsConnection && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="qr" className="flex-1 gap-2">
                      <QrCode className="h-4 w-4" />
                      QR Code
                    </TabsTrigger>
                    <TabsTrigger value="pairing_code" className="flex-1 gap-2">
                      <Hash className="h-4 w-4" />
                      Phone Number
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="qr" className="space-y-4">
                    {status === "qr_ready" && connection?.qrCode ? (
                      <div className="flex flex-col items-center gap-4 pt-4">
                        <div className="rounded-xl bg-white p-4">
                          <QRCodeSVG
                            value={connection.qrCode}
                            size={256}
                            level="M"
                          />
                        </div>
                        <p className="text-sm text-content-secondary text-center max-w-sm">
                          Open WhatsApp on your phone, go to Settings &rarr; Linked Devices &rarr; Link a Device, then scan this QR code
                        </p>
                        <Button variant="outline" size="sm" onClick={() => handleConnect("qr")} disabled={connecting}>
                          {connecting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Refreshing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Refresh QR Code
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 py-6">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                          <QrCode className="h-8 w-8 text-content-tertiary" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-content-primary">Scan with WhatsApp</p>
                          <p className="text-xs text-content-tertiary mt-1">
                            A QR code will appear for you to scan with your phone
                          </p>
                        </div>
                        <Button onClick={() => handleConnect("qr")} disabled={connecting}>
                          {connecting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating QR Code...
                            </>
                          ) : (
                            "Generate QR Code"
                          )}
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="pairing_code" className="space-y-4">
                    {status === "pairing_code_ready" && connection?.pairingCode ? (
                      <div className="flex flex-col items-center gap-4 pt-4">
                        <div className="rounded-xl bg-background-tertiary p-6">
                          <p className="text-3xl font-mono font-bold tracking-[0.3em] text-content-primary text-center">
                            {connection.pairingCode.slice(0, 4)}-{connection.pairingCode.slice(4)}
                          </p>
                        </div>
                        <p className="text-sm text-content-secondary text-center max-w-sm">
                          Open WhatsApp on your phone, go to Settings &rarr; Linked Devices &rarr; Link a Device &rarr; Link with phone number instead, then enter this code
                        </p>
                        <Button variant="outline" size="sm" onClick={() => handleConnect("pairing_code")} disabled={connecting}>
                          {connecting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Refreshing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Refresh Pairing Code
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="phone-number" className="text-content-primary">Phone Number</Label>
                          <Input
                            id="phone-number"
                            placeholder="e.g. 27821234567"
                            value={pairingPhoneNumber}
                            onChange={(e) => setPairingPhoneNumber(e.target.value)}
                            className="bg-background-tertiary"
                          />
                          <p className="text-xs text-content-tertiary">
                            Enter the full phone number with country code, digits only
                          </p>
                        </div>
                        <Button
                          onClick={() => handleConnect("pairing_code")}
                          disabled={connecting || !pairingPhoneNumber.replace(/\D/g, "")}
                          className="w-full"
                        >
                          {connecting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating Pairing Code...
                            </>
                          ) : (
                            "Get Pairing Code"
                          )}
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
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
        </>
      ) : (
        <Card className="mb-6 bg-background-secondary">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <PowerOff className="h-8 w-8 text-content-tertiary" />
              <p className="text-sm text-content-secondary">
                Enable the WhatsApp integration to configure your connection
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
