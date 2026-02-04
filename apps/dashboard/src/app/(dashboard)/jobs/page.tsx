"use client"

import { useState } from "react"
import {
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Skull,
  AlertCircle,
  RefreshCw,
  XOctagon,
  Filter,
  Loader2,
} from "lucide-react"
import { useJobs, useJobStats, useRetryJob, useCancelJob } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
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
import { Doc } from "@convex/_generated/dataModel"

type JobStatus = "pending" | "claimed" | "running" | "completed" | "failed" | "dead"

const STATUS_OPTIONS = [
  { value: "all", label: "All Status", icon: Filter },
  { value: "pending", label: "Pending", icon: Clock },
  { value: "running", label: "Running", icon: Play },
  { value: "completed", label: "Completed", icon: CheckCircle },
  { value: "failed", label: "Failed", icon: XCircle },
  { value: "dead", label: "Dead", icon: Skull },
]

function getStatusIcon(status: JobStatus) {
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

function getStatusVariant(status: JobStatus): "default" | "secondary" | "destructive" | "success" | "warning" {
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
  const [statusFilter, setStatusFilter] = useState<JobStatus | undefined>(undefined)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { environment } = useEnvironment()

  const jobs = useJobs(environment, statusFilter)
  const stats = useJobStats()
  const retryJob = useRetryJob()
  const cancelJob = useCancelJob()

  const handleCancel = async (jobId: string) => {
    setActionLoading(jobId)
    try {
      await cancelJob({ id: jobId as any })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRetry = async (jobId: string) => {
    setActionLoading(jobId)
    try {
      await retryJob({ id: jobId as any })
    } finally {
      setActionLoading(null)
    }
  }

  if (jobs === undefined || stats === undefined) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold">Job Monitoring</h2>
          <p className="text-muted-foreground">Monitor and manage background jobs</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold">Job Monitoring</h2>
        <p className="text-muted-foreground">Monitor and manage background jobs</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-500/10 p-2">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending || 0}</p>
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
                <p className="text-2xl font-bold">{stats.running || 0}</p>
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
                <p className="text-2xl font-bold">{stats.completed || 0}</p>
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
                <p className="text-2xl font-bold">{stats.failed || 0}</p>
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
                <p className="text-2xl font-bold">{stats.dead || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Jobs</CardTitle>
              <CardDescription>{jobs.length} jobs</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter || "all"}
                onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v as JobStatus)}
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-medium">No jobs found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Jobs will appear here when they are scheduled
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job: Doc<"jobs">) => (
                <div
                  key={job._id}
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
                        <span>ID: {job._id}</span>
                        <span>Attempts: {job.attempts}/{job.maxAttempts}</span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Scheduled: {formatDate(new Date(job.scheduledFor).toISOString())}
                        {job.completedAt && ` | Completed: ${formatDate(new Date(job.completedAt).toISOString())}`}
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
                        onClick={() => handleCancel(job._id)}
                        disabled={actionLoading === job._id}
                      >
                        <XOctagon className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                    {(job.status === "failed" || job.status === "dead") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(job._id)}
                        disabled={actionLoading === job._id}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
