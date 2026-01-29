"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Skull,
  AlertCircle,
  RefreshCw,
  XOctagon,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react"
import { api, Job, JobStats, JobQueryParams } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/lib/utils"

const STATUS_OPTIONS = [
  { value: "all", label: "All Status", icon: Filter },
  { value: "pending", label: "Pending", icon: Clock },
  { value: "running", label: "Running", icon: Play },
  { value: "completed", label: "Completed", icon: CheckCircle },
  { value: "failed", label: "Failed", icon: XCircle },
  { value: "dead", label: "Dead", icon: Skull },
]

function getStatusIcon(status: Job["status"]) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-500" />
    case "claimed":
    case "running":
      return <Play className="h-4 w-4 text-blue-500" />
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "dead":
      return <Skull className="h-4 w-4 text-gray-500" />
    default:
      return <AlertCircle className="h-4 w-4" />
  }
}

function getStatusVariant(status: Job["status"]): "default" | "secondary" | "destructive" | "success" | "warning" {
  switch (status) {
    case "pending":
      return "warning"
    case "claimed":
    case "running":
      return "default"
    case "completed":
      return "success"
    case "failed":
      return "destructive"
    case "dead":
      return "secondary"
    default:
      return "secondary"
  }
}

export default function JobsPage() {
  const { getToken } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<JobStats | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const pageSize = 25

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const token = await getToken()

      if (!token) {
        throw new Error("Not authenticated")
      }

      const [jobsRes, statsRes] = await Promise.all([
        api.jobs.list(token, {
          status: status !== "all" ? status : undefined,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        } as JobQueryParams),
        api.jobs.stats(token).catch(() => null),
      ])

      setJobs(jobsRes.jobs)
      setTotal(jobsRes.total)
      setStats(statsRes)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs")
    } finally {
      setLoading(false)
    }
  }, [status, page, getToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCancel = async (jobId: string) => {
    setActionLoading(jobId)
    try {
      const token = await getToken()

      if (!token) throw new Error("Not authenticated")

      await api.jobs.cancel(token, jobId)
      fetchData()
    } catch (e) {
      console.error("Failed to cancel job:", e)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRetry = async (jobId: string) => {
    setActionLoading(jobId)
    try {
      const token = await getToken()

      if (!token) throw new Error("Not authenticated")

      await api.jobs.retry(token, jobId)
      fetchData()
    } catch (e) {
      console.error("Failed to retry job:", e)
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Job Monitoring</h2>
        <p className="text-muted-foreground">Monitor and manage background jobs</p>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-yellow-500/10 p-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-500/10 p-2">
                  <Play className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Running</p>
                  <p className="text-2xl font-bold">{stats.running}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-500/10 p-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-500/10 p-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gray-500/10 p-2">
                  <Skull className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dead</p>
                  <p className="text-2xl font-bold">{stats.dead}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Jobs</CardTitle>
              <CardDescription>{total} total jobs</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchData}>
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-medium">No jobs found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Jobs will appear here when they are scheduled
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(job.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{job.jobType}</span>
                          <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                          <span>ID: {job.id}</span>
                          {job.entityId && <span>Entity: {job.entityId}</span>}
                          <span>Attempts: {job.attempts}/{job.maxAttempts}</span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Scheduled: {formatDate(job.scheduledFor)}
                          {job.completedAt && ` | Completed: ${formatDate(job.completedAt)}`}
                        </div>
                        {job.errorMessage && (
                          <p className="mt-2 text-sm text-destructive">{job.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {job.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(job.id)}
                          disabled={actionLoading === job.id}
                        >
                          <XOctagon className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                      {(job.status === "failed" || job.status === "dead") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(job.id)}
                          disabled={actionLoading === job.id}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
