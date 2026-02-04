"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Package,
  CheckCircle,
  ArrowUpCircle,
  Loader2,
  AlertCircle,
  ChevronLeft,
  Clock,
  User,
  FileText,
  Shield,
  History,
  AlertTriangle,
  Wrench,
} from "lucide-react"
import { usePack, useInstallPack, useUpgradePack, usePreviewUpgrade, useRepairPack } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function PackDetailPage() {
  const params = useParams()
  const packId = params.id as string
  const { environment } = useEnvironment()

  const pack = usePack(packId, environment)
  const upgradePreview = usePreviewUpgrade(pack?.hasUpgrade ? packId : undefined)
  const installPack = useInstallPack()
  const upgradePack = useUpgradePack()
  const repairPack = useRepairPack()

  const [dialogMode, setDialogMode] = useState<"install" | "upgrade" | "repair" | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInstall = async () => {
    setIsProcessing(true)
    setError(null)
    try {
      await installPack({ packId })
      setDialogMode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Installation failed")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpgrade = async () => {
    setIsProcessing(true)
    setError(null)
    try {
      await upgradePack({ packId })
      setDialogMode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upgrade failed")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRepair = async () => {
    setIsProcessing(true)
    setError(null)
    try {
      await repairPack({ packId })
      setDialogMode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repair failed")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCloseDialog = () => {
    if (!isProcessing) {
      setDialogMode(null)
      setError(null)
    }
  }

  if (pack === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  if (pack === null) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-content-tertiary mb-4" />
          <h3 className="text-lg font-medium text-content-primary">Pack not found</h3>
          <p className="text-content-secondary mt-1">The requested pack does not exist</p>
          <Link href="/settings/packs">
            <Button variant="outline" className="mt-4">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Packs
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Link href="/settings/packs">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <span className="text-content-secondary">Solution Packs</span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-content-primary">{pack.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-content-secondary">v{pack.version}</span>
              <span className="text-sm text-content-tertiary">by {pack.author}</span>
              <Badge variant="outline" className="text-xs">{pack.license}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pack.isInstalled ? (
            <>
              <Badge variant="secondary" className="flex items-center gap-1 py-1">
                <CheckCircle className="h-3 w-3" />
                Installed v{pack.installedVersion}
              </Badge>
              {pack.hasUpgrade && (
                <Button onClick={() => setDialogMode("upgrade")} className="flex items-center gap-1">
                  <ArrowUpCircle className="h-4 w-4" />
                  Upgrade to v{pack.version}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={() => setDialogMode("install")}>Install Pack</Button>
          )}
        </div>
      </div>

      <p className="text-content-secondary">{pack.description}</p>

      {pack.status === "failed" && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Last upgrade failed</p>
            <p className="text-sm mt-1 opacity-80">
              Please try upgrading again or contact support if the issue persists.
            </p>
          </div>
        </div>
      )}

      {pack.hasDrift && pack.driftDetails && (
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-yellow-500" />
            <div>
              <p className="font-medium text-yellow-500">Resources out of sync</p>
              <p className="text-sm mt-1 text-yellow-500/80">
                Some pack resources are missing. This may have happened from a CLI sync that didn't preserve pack resources.
              </p>
              <div className="mt-2 space-y-1">
                {pack.driftDetails.missingEntityTypes.length > 0 && (
                  <p className="text-sm text-yellow-500/70">
                    Missing entity types: {pack.driftDetails.missingEntityTypes.join(", ")}
                  </p>
                )}
                {pack.driftDetails.missingRoles.length > 0 && (
                  <p className="text-sm text-yellow-500/70">
                    Missing roles: {pack.driftDetails.missingRoles.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </div>
          <Button onClick={() => setDialogMode("repair")} variant="outline" className="flex-shrink-0 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10">
            <Wrench className="mr-2 h-4 w-4" />
            Repair
          </Button>
        </div>
      )}

      <Tabs defaultValue="contents" className="mt-6">
        <TabsList>
          <TabsTrigger value="contents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Contents
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
          {pack.isInstalled && (
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="contents" className="mt-6">
          <Card className="bg-background-secondary">
            <CardHeader>
              <CardTitle className="text-lg">Entity Types</CardTitle>
              <CardDescription>Data models included in this pack</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pack.entityTypes.map((et: { name: string; slug: string; description: string }) => (
                  <div key={et.slug} className="flex items-start justify-between p-3 rounded-lg bg-background-tertiary">
                    <div>
                      <h4 className="font-medium text-content-primary">{et.name}</h4>
                      <p className="text-sm text-content-secondary mt-0.5">{et.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{et.slug}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <Card className="bg-background-secondary">
            <CardHeader>
              <CardTitle className="text-lg">Roles & Permissions</CardTitle>
              <CardDescription>Access control configuration included in this pack</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pack.roles.map((role: { name: string; description: string; isSystem: boolean; policies: unknown[] }) => (
                  <div key={role.name} className="p-3 rounded-lg bg-background-tertiary">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-content-primary">{role.name}</h4>
                      <div className="flex items-center gap-2">
                        {role.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                        <Badge variant="outline" className="text-xs">
                          {role.policies.length} policies
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-content-secondary mt-1">{role.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {pack.isInstalled && (
          <TabsContent value="history" className="mt-6">
            <Card className="bg-background-secondary">
              <CardHeader>
                <CardTitle className="text-lg">Installation History</CardTitle>
                <CardDescription>Version history and upgrades</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pack.installedAt && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-background-tertiary">
                      <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-content-primary">Installed</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-content-secondary">
                          <Clock className="h-3 w-3" />
                          {formatDate(pack.installedAt)}
                        </div>
                      </div>
                    </div>
                  )}

                  {pack.upgradeHistory?.map((upgrade: { fromVersion: string; toVersion: string; upgradedAt: number }, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background-tertiary">
                      <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <ArrowUpCircle className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-content-primary">
                          Upgraded from v{upgrade.fromVersion} to v{upgrade.toVersion}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-content-secondary">
                          <Clock className="h-3 w-3" />
                          {formatDate(upgrade.upgradedAt)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {pack.customizations && (pack.customizations.entityTypes.length > 0 || pack.customizations.roles.length > 0) && (
                    <div className="mt-6">
                      <h4 className="font-medium text-content-primary mb-3">Customizations</h4>
                      <p className="text-sm text-content-secondary mb-2">
                        These items have been customized and will be preserved during upgrades:
                      </p>
                      <div className="space-y-2">
                        {pack.customizations.entityTypes.map((slug: string) => (
                          <Badge key={slug} variant="outline" className="mr-2">
                            Entity: {slug}
                          </Badge>
                        ))}
                        {pack.customizations.roles.map((name: string) => (
                          <Badge key={name} variant="outline" className="mr-2">
                            Role: {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={dialogMode === "install"} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install {pack.name}?</DialogTitle>
            <DialogDescription>
              This will create the following resources in your organization:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ul className="list-disc pl-6 space-y-2 text-sm text-content-secondary">
              <li>{pack.entityTypes.length} entity types</li>
              <li>{pack.roles.length} roles with preconfigured policies</li>
            </ul>
            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleInstall} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                "Install"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "upgrade"} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upgrade {pack.name}?</DialogTitle>
            <DialogDescription>
              Upgrade from v{pack.installedVersion} to v{pack.version}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {upgradePreview?.isMajor && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-500">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Major version upgrade</p>
                  <p className="mt-1 text-yellow-500/80">
                    This upgrade may include breaking changes.
                  </p>
                </div>
              </div>
            )}

            {upgradePreview?.automaticChanges && upgradePreview.automaticChanges.length > 0 && (
              <div>
                <h4 className="font-medium text-content-primary mb-2">Changes to apply:</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm text-content-secondary">
                  {upgradePreview.automaticChanges.map((change: { type: string; description: string }, i: number) => (
                    <li key={i}>{change.description}</li>
                  ))}
                </ul>
              </div>
            )}

            {upgradePreview?.skippedDueToCustomization && upgradePreview.skippedDueToCustomization.length > 0 && (
              <div className="p-3 rounded-lg bg-background-tertiary">
                <h4 className="font-medium text-content-primary mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Skipped (customized)
                </h4>
                <ul className="list-disc pl-6 space-y-1 text-sm text-content-secondary">
                  {upgradePreview.skippedDueToCustomization.map((change: { type: string; description: string }, i: number) => (
                    <li key={i}>{change.description}</li>
                  ))}
                </ul>
              </div>
            )}

            {upgradePreview?.automaticChanges?.length === 0 && upgradePreview?.skippedDueToCustomization?.length === 0 && (
              <p className="text-sm text-content-secondary">
                No migration steps required for this upgrade.
              </p>
            )}
            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleUpgrade} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Upgrading...
                </>
              ) : (
                "Upgrade"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "repair"} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repair {pack.name}?</DialogTitle>
            <DialogDescription>
              This will recreate missing pack resources that were accidentally deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {pack.driftDetails && (
              <div className="space-y-2 text-sm text-content-secondary">
                {pack.driftDetails.missingEntityTypes.length > 0 && (
                  <p>
                    <span className="font-medium text-content-primary">Entity types to recreate:</span>{" "}
                    {pack.driftDetails.missingEntityTypes.join(", ")}
                  </p>
                )}
                {pack.driftDetails.missingRoles.length > 0 && (
                  <p>
                    <span className="font-medium text-content-primary">Roles to recreate:</span>{" "}
                    {pack.driftDetails.missingRoles.join(", ")}
                  </p>
                )}
              </div>
            )}
            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleRepair} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Repairing...
                </>
              ) : (
                "Repair Pack"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
