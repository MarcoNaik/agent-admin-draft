"use client"

import { Loader2 } from "lucide-react"
import { useCurrentUser, useCurrentOrganization } from "@/hooks/use-convex-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function SettingsPage() {
  const user = useCurrentUser()
  const organization = useCurrentOrganization()

  if (user === undefined || organization === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">General</h1>
          <p className="text-sm text-content-secondary">Organization and profile settings</p>
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
        <h1 className="text-xl font-semibold text-content-primary">General</h1>
        <p className="text-sm text-content-secondary">Organization and profile settings</p>
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Organization</CardTitle>
          <CardDescription className="text-content-secondary">Your organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-name" className="text-content-primary">Organization Name</Label>
              <Input
                id="org-name"
                defaultValue={organization?.name || ""}
                disabled
                className="bg-background-tertiary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug" className="text-content-primary">Slug</Label>
              <Input
                id="org-slug"
                defaultValue={organization?.slug || ""}
                disabled
                className="bg-background-tertiary"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-content-secondary">Current Plan:</span>
            <Badge variant="secondary" className="capitalize">
              {organization?.plan || "free"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Profile</CardTitle>
          <CardDescription className="text-content-secondary">Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-content-primary">Name</Label>
              <Input id="name" defaultValue={user?.name || ""} disabled className="bg-background-tertiary" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-content-primary">Email</Label>
              <Input id="email" defaultValue={user?.email || ""} disabled className="bg-background-tertiary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
