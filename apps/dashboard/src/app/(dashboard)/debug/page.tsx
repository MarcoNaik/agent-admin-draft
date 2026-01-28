import { auth } from "@clerk/nextjs/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787"

export const dynamic = "force-dynamic"

async function testApiHealth() {
  try {
    const res = await fetch(`${API_URL}/v1/debug/health`, { cache: "no-store" })
    return { success: true, data: await res.json() }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

async function testDbConnection() {
  try {
    const res = await fetch(`${API_URL}/v1/debug/db-test`, { cache: "no-store" })
    return { success: true, data: await res.json() }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

async function testTokenVerification(token: string | null) {
  if (!token) {
    return { success: false, error: "No token available" }
  }
  try {
    const res = await fetch(`${API_URL}/v1/debug/verify-token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    })
    return { success: res.ok, data: await res.json(), status: res.status }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export default async function DebugPage() {
  const { userId, sessionId, orgId, getToken } = await auth()

  const token = await getToken()
  const tokenPreview = token ? `${token.slice(0, 50)}...${token.slice(-20)}` : "NULL"
  const tokenLength = token?.length || 0

  let tokenPayload: Record<string, unknown> | null = null
  if (token) {
    try {
      const parts = token.split(".")
      if (parts.length === 3) {
        tokenPayload = JSON.parse(atob(parts[1]))
      }
    } catch {
      tokenPayload = { error: "Failed to decode" }
    }
  }

  const [healthResult, dbResult, verifyResult] = await Promise.all([
    testApiHealth(),
    testDbConnection(),
    testTokenVerification(token)
  ])

  const hypotheses = [
    {
      id: 1,
      name: "User is authenticated with Clerk",
      status: !!userId,
      details: { userId: userId?.slice(0, 15) + "...", sessionId: sessionId?.slice(0, 15) + "..." }
    },
    {
      id: 2,
      name: "getToken() returns a valid token",
      status: !!token && tokenLength > 100,
      details: { tokenLength, preview: tokenPreview }
    },
    {
      id: 3,
      name: "Token is a valid JWT (3 parts)",
      status: token?.split(".").length === 3,
      details: { parts: token?.split(".").length }
    },
    {
      id: 4,
      name: "Token payload has required claims",
      status: !!(tokenPayload?.sub && tokenPayload?.exp),
      details: {
        sub: tokenPayload?.sub,
        exp: tokenPayload?.exp,
        iat: tokenPayload?.iat,
        azp: tokenPayload?.azp,
        iss: tokenPayload?.iss
      }
    },
    {
      id: 5,
      name: "Token is not expired",
      status: tokenPayload?.exp ? (tokenPayload.exp as number) * 1000 > Date.now() : false,
      details: {
        expDate: tokenPayload?.exp ? new Date((tokenPayload.exp as number) * 1000).toISOString() : "N/A",
        now: new Date().toISOString(),
        msUntilExpiry: tokenPayload?.exp ? (tokenPayload.exp as number) * 1000 - Date.now() : "N/A"
      }
    },
    {
      id: 6,
      name: "API is reachable",
      status: healthResult.success,
      details: healthResult
    },
    {
      id: 7,
      name: "API has correct environment",
      status: healthResult.success && healthResult.data?.env?.hasClerkSecretKey,
      details: healthResult.data?.env
    },
    {
      id: 8,
      name: "Database is accessible",
      status: dbResult.success && dbResult.data?.success,
      details: dbResult
    },
    {
      id: 9,
      name: "Token verification succeeds",
      status: verifyResult.success,
      details: verifyResult
    },
    {
      id: 10,
      name: "User exists in database after verification",
      status: verifyResult.success && verifyResult.data?.steps?.some((s: { step: string; value: boolean }) => s.step === "User Found" && s.value),
      details: verifyResult.data?.steps?.filter((s: { step: string }) => s.step.includes("User") || s.step.includes("DB"))
    }
  ]

  const passCount = hypotheses.filter(h => h.status).length
  const failCount = hypotheses.filter(h => !h.status).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Auth Debug</h1>
        <p className="text-muted-foreground">Testing all 10 hypotheses for auth failure</p>
        <p className="mt-2 text-sm">
          <span className="text-green-500 font-bold">{passCount} passed</span>
          {" / "}
          <span className="text-red-500 font-bold">{failCount} failed</span>
        </p>
      </div>

      <div className="grid gap-4">
        {hypotheses.map((h) => (
          <Card key={h.id} className={h.status ? "border-green-500/50" : "border-red-500/50"}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className={`text-lg ${h.status ? "text-green-500" : "text-red-500"}`}>
                  {h.status ? "✓" : "✗"}
                </span>
                <span>#{h.id}: {h.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(h.details, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-2 rounded">
            {JSON.stringify({
              API_URL,
              NODE_ENV: process.env.NODE_ENV
            }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
