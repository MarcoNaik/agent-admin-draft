"use client"

import { Loader2 } from "lucide-react"
import { useCurrentUser, useCurrentOrganization } from "@/hooks/use-convex-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function SettingsPage() {
  const user = useCurrentUser()
  const organization = useCurrentOrganization()

  if (user === undefined || organization === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <div>
          <h1 className="text-xl font-semibold text-content-primary">Settings</h1>
          <p className="text-content-secondary">Manage your account and organization</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">Settings</h1>
        <p className="text-content-secondary">Manage your account and organization</p>
      </div>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Organization</CardTitle>
          <CardDescription className="text-content-secondary">Your organization settings</CardDescription>
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

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-content-primary">Billing</CardTitle>
          <CardDescription className="text-content-secondary">Manage your subscription and payment methods</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="bg-background-tertiary hover:bg-background-primary">Manage Billing</Button>
        </CardContent>
      </Card>

      <Card className="border-destructive bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription className="text-content-secondary">Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive">Delete Organization</Button>
        </CardContent>
      </Card>
    </div>
  )
}
