"use client"

import { useState } from "react"
import Link from "next/link"
import { Package, CheckCircle, ArrowUpCircle, Loader2, AlertCircle, AlertTriangle } from "lucide-react"
import { usePacks, useInstallPack, useUpgradePack } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PackData {
  id: string
  name: string
  version: string
  description: string
  author: string
  license: string
  entityTypes: unknown[]
  roles: unknown[]
  isInstalled: boolean
  installedVersion?: string
  hasUpgrade: boolean
  upgradeType?: string
  status?: string
  hasDrift?: boolean
  driftDetails?: {
    missingEntityTypes: string[]
    missingRoles: string[]
  }
}

function PackCard({ pack, onInstall, onUpgrade }: {
  pack: PackData
  onInstall: (packId: string) => void
  onUpgrade: (packId: string) => void
}) {
  return (
    <Card className={`bg-background-secondary flex flex-col ${pack.hasDrift ? "border-yellow-500/50" : ""}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg text-content-primary">{pack.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-content-secondary">v{pack.version}</span>
                <span className="text-xs text-content-tertiary">by {pack.author}</span>
              </div>
            </div>
          </div>
          {pack.isInstalled && (
            pack.hasDrift ? (
              <Badge variant="outline" className="flex items-center gap-1 border-yellow-500/50 text-yellow-500">
                <AlertTriangle className="h-3 w-3" />
                Needs Repair
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Installed
              </Badge>
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <CardDescription className="text-content-secondary">{pack.description}</CardDescription>
        {pack.hasDrift && pack.driftDetails && (
          <div className="mt-3 p-2 rounded bg-yellow-500/10 text-xs text-yellow-500">
            Missing: {[...pack.driftDetails.missingEntityTypes, ...pack.driftDetails.missingRoles].join(", ")}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            {pack.entityTypes.length} entity types
          </Badge>
          <Badge variant="outline" className="text-xs">
            {pack.roles.length} roles
          </Badge>
          <Badge variant="outline" className="text-xs">
            {pack.license}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center border-t border-border pt-4">
        {pack.isInstalled ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-content-secondary">
              v{pack.installedVersion}
            </span>
            <div className="flex items-center gap-2">
              {pack.hasDrift ? (
                <Link href={`/settings/packs/${pack.id}`}>
                  <Button size="sm" variant="outline" className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10">
                    <AlertTriangle className="mr-1 h-4 w-4" />
                    Repair
                  </Button>
                </Link>
              ) : pack.hasUpgrade ? (
                <Button size="sm" onClick={() => onUpgrade(pack.id)} className="flex items-center gap-1">
                  <ArrowUpCircle className="h-4 w-4" />
                  Upgrade to v{pack.version}
                </Button>
              ) : null}
              <Link href={`/settings/packs/${pack.id}`}>
                <Button variant="outline" size="sm">View Details</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-content-tertiary">Not installed</span>
            <Button size="sm" onClick={() => onInstall(pack.id)}>
              Install Pack
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

export default function PacksPage() {
  const { environment } = useEnvironment()
  const packs = usePacks(environment)
  const installPack = useInstallPack()
  const upgradePack = useUpgradePack()

  const [selectedPack, setSelectedPack] = useState<PackData | null>(null)
  const [dialogMode, setDialogMode] = useState<"install" | "upgrade" | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInstallClick = (packId: string) => {
    const pack = packs?.find((p: PackData) => p.id === packId)
    if (pack) {
      setSelectedPack(pack)
      setDialogMode("install")
    }
  }

  const handleUpgradeClick = (packId: string) => {
    const pack = packs?.find((p: PackData) => p.id === packId)
    if (pack) {
      setSelectedPack(pack)
      setDialogMode("upgrade")
    }
  }

  const handleConfirmInstall = async () => {
    if (!selectedPack) return
    setIsProcessing(true)
    setError(null)
    try {
      await installPack({ packId: selectedPack.id })
      setDialogMode(null)
      setSelectedPack(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Installation failed")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmUpgrade = async () => {
    if (!selectedPack) return
    setIsProcessing(true)
    setError(null)
    try {
      await upgradePack({ packId: selectedPack.id })
      setDialogMode(null)
      setSelectedPack(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upgrade failed")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCloseDialog = () => {
    if (!isProcessing) {
      setDialogMode(null)
      setSelectedPack(null)
      setError(null)
    }
  }

  if (packs === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Solution Packs</h1>
          <p className="text-sm text-content-secondary">Pre-built configurations for common business domains</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const installedPacks = packs.filter((p: PackData) => p.isInstalled)
  const availablePacks = packs.filter((p: PackData) => !p.isInstalled)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Solution Packs</h1>
        <p className="text-sm text-content-secondary">Pre-built configurations for common business domains</p>
      </div>

      {installedPacks.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-content-primary mb-4">Installed Packs</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {installedPacks.map((pack: PackData) => (
              <PackCard
                key={pack.id}
                pack={pack}
                onInstall={handleInstallClick}
                onUpgrade={handleUpgradeClick}
              />
            ))}
          </div>
        </div>
      )}

      {availablePacks.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-content-primary mb-4">Available Packs</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {availablePacks.map((pack: PackData) => (
              <PackCard
                key={pack.id}
                pack={pack}
                onInstall={handleInstallClick}
                onUpgrade={handleUpgradeClick}
              />
            ))}
          </div>
        </div>
      )}

      {packs.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-content-tertiary mb-4" />
          <h3 className="text-lg font-medium text-content-primary">No packs available</h3>
          <p className="text-content-secondary mt-1">Check back later for new solution packs</p>
        </div>
      )}

      <Dialog open={dialogMode === "install"} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install {selectedPack?.name}?</DialogTitle>
            <DialogDescription>
              This will create the following resources in your organization:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ul className="list-disc pl-6 space-y-2 text-sm text-content-secondary">
              <li>{selectedPack?.entityTypes.length} entity types</li>
              <li>{selectedPack?.roles.length} roles with preconfigured policies</li>
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
            <Button onClick={handleConfirmInstall} disabled={isProcessing}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade {selectedPack?.name}?</DialogTitle>
            <DialogDescription>
              Upgrade from v{selectedPack?.installedVersion} to v{selectedPack?.version}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedPack?.upgradeType === "major" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-500 mb-4">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Major version upgrade</p>
                  <p className="mt-1 text-yellow-500/80">
                    This upgrade may include breaking changes. Review the changes in the pack details before proceeding.
                  </p>
                </div>
              </div>
            )}
            <p className="text-sm text-content-secondary">
              Your customizations will be preserved during the upgrade.
            </p>
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
            <Button onClick={handleConfirmUpgrade} disabled={isProcessing}>
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
    </div>
  )
}
