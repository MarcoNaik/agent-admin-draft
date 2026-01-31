"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Clock, Loader2, User, FileText, CheckCircle } from "lucide-react"
import { useEntities, useEntity } from "@/hooks/use-convex-data"
import { useCurrentRole } from "@/hooks/use-current-role"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Doc, Id } from "@convex/_generated/dataModel"

type StatusFilter = "upcoming" | "completed" | "all"

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "scheduled":
    case "confirmed":
      return "default"
    case "completed":
      return "secondary"
    case "cancelled":
      return "destructive"
    default:
      return "outline"
  }
}

interface SessionCardProps {
  session: Doc<"entities">
  onClick: () => void
}

function SessionCard({ session, onClick }: SessionCardProps) {
  const studentId = session.data?.studentId as Id<"entities"> | undefined
  const student = useEntity(studentId as Id<"entities">)
  const startTime = session.data?.startTime as number | undefined
  const duration = session.data?.duration as number | undefined
  const subject = session.data?.subject as string | undefined
  const hasReport = !!session.data?.reportSubmittedAt

  return (
    <Card
      className="cursor-pointer hover:bg-background-tertiary transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-content-secondary" />
              <span className="font-medium text-content-primary">
                {student?.data?.name || "Loading..."}
              </span>
            </div>
            {subject && (
              <p className="text-sm text-content-secondary">{subject}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-content-tertiary">
              {startTime && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateTime(startTime)}
                </span>
              )}
              {duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {duration} min
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={getStatusBadgeVariant(session.status)}>
              {session.status}
            </Badge>
            {hasReport && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Report submitted
              </span>
            )}
            {!hasReport && session.status === "completed" && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <FileText className="h-3.5 w-3.5" />
                Report pending
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function TeacherSessionsPage() {
  const router = useRouter()
  const { isLoading: roleLoading } = useCurrentRole()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming")

  const sessions = useEntities("session")

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    const now = Date.now()

    return sessions.filter((s: Doc<"entities">) => {
      const startTime = s.data?.startTime as number | undefined
      if (statusFilter === "upcoming") {
        return s.status === "scheduled" && startTime && startTime > now
      }
      if (statusFilter === "completed") {
        return s.status === "completed"
      }
      return true
    }).sort((a: Doc<"entities">, b: Doc<"entities">) => {
      const aTime = (a.data?.startTime as number) || 0
      const bTime = (b.data?.startTime as number) || 0
      return statusFilter === "upcoming" ? aTime - bTime : bTime - aTime
    })
  }, [sessions, statusFilter])

  if (roleLoading || sessions === undefined) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-content-primary mb-6">My Sessions</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-content-primary">My Sessions</h1>
        <p className="text-content-secondary">View and manage your tutoring sessions</p>
      </div>

      <div className="mb-6 flex gap-2">
        <Button
          variant={statusFilter === "upcoming" ? "default" : "outline"}
          onClick={() => setStatusFilter("upcoming")}
          size="sm"
        >
          Upcoming
        </Button>
        <Button
          variant={statusFilter === "completed" ? "default" : "outline"}
          onClick={() => setStatusFilter("completed")}
          size="sm"
        >
          Completed
        </Button>
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          onClick={() => setStatusFilter("all")}
          size="sm"
        >
          All
        </Button>
      </div>

      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-content-tertiary" />
            <h3 className="text-lg font-medium text-content-primary">No sessions found</h3>
            <p className="mt-1 text-content-secondary">
              {statusFilter === "upcoming"
                ? "You have no upcoming sessions scheduled."
                : statusFilter === "completed"
                ? "You have no completed sessions yet."
                : "You have no sessions."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session: Doc<"entities">) => (
            <SessionCard
              key={session._id}
              session={session}
              onClick={() => router.push(`/teacher/sessions/${session._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
