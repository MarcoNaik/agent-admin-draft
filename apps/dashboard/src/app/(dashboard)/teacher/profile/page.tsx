"use client"

import { Loader2, User, Mail } from "lucide-react"
import { useCurrentUser } from "@/hooks/use-convex-data"
import { CalendarConnectionCard } from "@/components/calendar-connection-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export default function TeacherProfilePage() {
  const user = useCurrentUser()

  if (user === undefined) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-display font-semibold text-content-primary mb-6">My Profile</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  if (user === null) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium text-content-primary">Profile not found</h3>
            <p className="mt-1 text-content-secondary">
              Unable to load your profile information.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-display font-semibold text-content-primary">My Profile</h1>
        <p className="text-content-secondary">View your account information</p>
      </div>

      <Card className="mb-6 bg-background-secondary">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-content-primary">{user.name || "Teacher"}</CardTitle>
              <CardDescription className="text-content-secondary flex items-center gap-2 mt-1">
                <Badge variant="secondary">Teacher</Badge>
                <span>Member since {formatDate(user.createdAt)}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="bg-background-secondary">
        <CardHeader>
          <CardTitle className="text-base text-content-primary">Account Information</CardTitle>
          <CardDescription className="text-content-secondary">
            Your personal details and contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-content-primary">Name</Label>
              <Input
                id="name"
                defaultValue={user.name || ""}
                disabled
                className="font-input bg-background-tertiary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-content-primary">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-content-tertiary" />
                <Input
                  id="email"
                  defaultValue={user.email || ""}
                  disabled
                  className="font-input bg-background-tertiary pl-9"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-content-tertiary">
            To update your profile information, please contact your administrator.
          </p>
        </CardContent>
      </Card>

      <CalendarConnectionCard />
    </div>
  )
}
