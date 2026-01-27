"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth, useUser, SignIn } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type AuthState = "loading" | "unauthenticated" | "authorizing" | "success" | "error"

export default function AuthorizePage() {
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const [state, setState] = useState<AuthState>("loading")
  const [error, setError] = useState<string | null>(null)

  const callback = searchParams.get("callback")

  useEffect(() => {
    if (!isLoaded) return

    if (!callback) {
      setState("error")
      setError("Missing callback parameter")
      return
    }

    if (!isValidCallback(callback)) {
      setState("error")
      setError("Invalid callback URL. Only localhost callbacks are allowed.")
      return
    }

    if (!isSignedIn) {
      setState("unauthenticated")
      return
    }

    setState("authorizing")
  }, [isLoaded, isSignedIn, callback])

  const handleAuthorize = async () => {
    if (!callback) return

    setState("authorizing")

    try {
      const token = await getToken()
      if (!token) {
        setState("error")
        setError("Failed to get authentication token")
        return
      }

      const sessionId = user?.id || crypto.randomUUID()
      const redirectUrl = new URL(callback)
      redirectUrl.searchParams.set("token", token)
      redirectUrl.searchParams.set("session_id", sessionId)

      setState("success")
      window.location.href = redirectUrl.toString()
    } catch (err) {
      setState("error")
      setError(err instanceof Error ? err.message : "Authorization failed")
    }
  }

  const handleCancel = () => {
    if (callback) {
      const redirectUrl = new URL(callback)
      redirectUrl.searchParams.set("error", "access_denied")
      redirectUrl.searchParams.set("error_description", "User cancelled authorization")
      window.location.href = redirectUrl.toString()
    }
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Authorization Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please close this window and try again from the CLI.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>CLI Authorization</CardTitle>
            <CardDescription>
              Sign in to authorize the Struere CLI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignIn
              afterSignInUrl={`/authorize?callback=${encodeURIComponent(callback || "")}`}
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none p-0",
                }
              }}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-green-500">Authorization Successful</CardTitle>
            <CardDescription>Redirecting back to CLI...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authorize CLI</CardTitle>
          <CardDescription>
            The Struere CLI is requesting access to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <TerminalIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{user?.primaryEmailAddress?.emailAddress}</p>
                <p className="text-sm text-muted-foreground">
                  Signed in as {user?.fullName || user?.username}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">This will allow the CLI to:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-green-500" />
                Access your agents and deployments
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-green-500" />
                Deploy and manage your agents
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-green-500" />
                View logs and usage data
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleCancel}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleAuthorize}>
              Authorize
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function isValidCallback(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
  } catch {
    return false
  }
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
