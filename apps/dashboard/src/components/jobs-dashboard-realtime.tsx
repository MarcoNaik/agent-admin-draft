"use client"

import { useJobs, useJobStats, useRetryJob, useCancelJob } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, XCircle, Clock, CheckCircle, AlertTriangle, Skull } from "lucide-react"
import { useState } from "react"
import { Doc } from "@convex/_generated/dataModel"

type JobStatus = "pending" | "claimed" | "running" | "completed" | "failed" | "dead"

const statusConfig: Record<JobStatus, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  claimed: { icon: Clock, color: "text-blue-500", label: "Claimed" },
  running: { icon: Loader2, color: "text-blue-500", label: "Running" },
  completed: { icon: CheckCircle, color: "text-green-500", label: "Completed" },
  failed: { icon: AlertTriangle, color: "text-red-500", label: "Failed" },
  dead: { icon: Skull, color: "text-gray-500", label: "Dead" },
}

export function JobsDashboardRealtime() {
  const [statusFilter, setStatusFilter] = useState<JobStatus | undefined>(undefined)
  const { environment } = useEnvironment()
  const jobs = useJobs(environment, statusFilter)
  const stats = useJobStats(environment)
  const retryJob = useRetryJob()
  const cancelJob = useCancelJob()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const handleRetry = async (id: string) => {
    setLoadingAction(id)
    try {
      await retryJob({ id: id as any })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this job?")) return
    setLoadingAction(id)
    try {
      await cancelJob({ id: id as any })
    } finally {
      setLoadingAction(null)
    }
  }

  if (jobs === undefined || stats === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-6">
        {(Object.keys(statusConfig) as JobStatus[]).map((status) => {
          const config = statusConfig[status]
          const Icon = config.icon
          const count = stats[status] ?? 0

          return (
            <Card
              key={status}
              className={`cursor-pointer transition-colors ${
                statusFilter === status ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setStatusFilter(statusFilter === status ? undefined : status)}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                  <Icon className={`h-5 w-5 ${config.color} ${status === "running" ? "animate-spin" : ""}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {statusFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Filtered by: <strong>{statusConfig[statusFilter].label}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter(undefined)}>
            Clear filter
          </Button>
        </div>
      )}

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {statusFilter ? `No ${statusConfig[statusFilter].label.toLowerCase()} jobs` : "No jobs found"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Attempts</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Scheduled</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Error</th>
                <th className="text-right px-4 py-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job: Doc<"jobs">) => {
                const config = statusConfig[job.status as JobStatus]
                const Icon = config.icon

                return (
                  <tr key={job._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{job.jobType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${config.color} ${job.status === "running" ? "animate-spin" : ""}`} />
                        <span className={`text-sm ${config.color}`}>{config.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {job.attempts} / {job.maxAttempts}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(job.scheduledFor).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {job.errorMessage && (
                        <span className="text-sm text-red-500 truncate max-w-xs block">
                          {job.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(job.status === "failed" || job.status === "dead") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(job._id)}
                            disabled={loadingAction === job._id}
                          >
                            {loadingAction === job._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {(job.status === "pending" || job.status === "claimed" || job.status === "running") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(job._id)}
                            disabled={loadingAction === job._id}
                            className="text-destructive hover:text-destructive"
                          >
                            {loadingAction === job._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
