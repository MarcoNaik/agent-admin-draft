"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"

interface TestResult {
  name: string
  status: "pass" | "fail" | "skip"
  message: string
  data?: unknown
  duration?: number
}

interface StatusResponse {
  tests: TestResult[]
  summary: { passed: number; failed: number; skipped: number; total: number }
  config: { clerkDomain: string; jwksUrl: string; expectedIssuer: string }
}

export default function StatusPage() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StatusResponse | null>(null)
  const [rawToken, setRawToken] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStatus() {
      try {
        const token = await getToken()
        setRawToken(token)

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const result = await response.json()

        if (!response.ok) {
          setError(JSON.stringify(result, null, 2))
        } else {
          setData(result)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [getToken])

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">API Status</h1>
        <p className="text-content-secondary">Loading diagnostics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">API Status</h1>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400 font-mono text-sm whitespace-pre-wrap">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">API Status Diagnostics</h1>
      <p className="text-content-secondary mb-6">Testing JWT verification pipeline</p>

      {data && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{data.summary.passed}</p>
              <p className="text-sm text-content-secondary">Passed</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{data.summary.failed}</p>
              <p className="text-sm text-content-secondary">Failed</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{data.summary.skipped}</p>
              <p className="text-sm text-content-secondary">Skipped</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{data.summary.total}</p>
              <p className="text-sm text-content-secondary">Total</p>
            </div>
          </div>

          <div className="bg-background-secondary rounded-lg border mb-6">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold">Configuration</h2>
            </div>
            <div className="p-4 font-mono text-sm space-y-1">
              <p><span className="text-content-secondary">Clerk Domain:</span> {data.config.clerkDomain}</p>
              <p><span className="text-content-secondary">JWKS URL:</span> {data.config.jwksUrl}</p>
              <p><span className="text-content-secondary">Expected Issuer:</span> {data.config.expectedIssuer}</p>
            </div>
          </div>

          <div className="bg-background-secondary rounded-lg border mb-6">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold">Test Results</h2>
            </div>
            <div className="divide-y">
              {data.tests.map((test, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`w-2 h-2 rounded-full ${
                      test.status === "pass" ? "bg-green-400" :
                      test.status === "fail" ? "bg-red-400" : "bg-yellow-400"
                    }`} />
                    <span className="font-mono text-sm font-medium">{test.name}</span>
                    {test.duration && (
                      <span className="text-xs text-content-tertiary">{test.duration}ms</span>
                    )}
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                      test.status === "pass" ? "bg-green-500/20 text-green-400" :
                      test.status === "fail" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {test.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-content-secondary mb-2">{test.message}</p>
                  {test.data !== undefined && test.data !== null && (
                    <pre className="text-xs bg-background-primary rounded p-2 overflow-x-auto">
                      {JSON.stringify(test.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>

          {rawToken && (
            <div className="bg-background-secondary rounded-lg border">
              <div className="px-4 py-3 border-b">
                <h2 className="font-semibold">Raw JWT Token</h2>
              </div>
              <div className="p-4">
                <pre className="text-xs bg-background-primary rounded p-2 overflow-x-auto break-all whitespace-pre-wrap">
                  {rawToken}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
