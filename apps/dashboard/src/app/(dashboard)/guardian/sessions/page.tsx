"use client"

import { useMemo } from "react"
import { Calendar, Clock, Loader2, User } from "lucide-react"
import { useEntities, useEntity } from "@/hooks/use-convex-data"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Doc, Id } from "@convex/_generated/dataModel"

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

interface SessionCardProps {
  session: Doc<"entities">
}

function SessionCard({ session }: SessionCardProps) {
  const teacherId = session.data?.teacherId as Id<"entities"> | undefined
  const teacher = useEntity(teacherId as Id<"entities">)
  const studentId = session.data?.studentId as Id<"entities"> | undefined
  const student = useEntity(studentId as Id<"entities">)
  const startTime = session.data?.startTime as number | undefined
  const duration = session.data?.duration as number | undefined
  const subject = session.data?.subject as string | undefined

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-content-primary">
                {student?.data?.name || "Student"}
              </span>
              {subject && (
                <Badge variant="secondary">{subject}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-content-secondary">
              <User className="h-3.5 w-3.5" />
              <span>with {teacher?.data?.name || "Teacher"}</span>
            </div>
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
          <Badge
            variant={
              session.status === "completed"
                ? "secondary"
                : session.status === "cancelled"
                ? "destructive"
                : "default"
            }
          >
            {session.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

export default function GuardianSessionsPage() {
  const sessions = useEntities("session")

  const upcomingSessions = useMemo(() => {
    if (!sessions) return []
    const now = Date.now()
    return sessions.filter((s: Doc<"entities">) => {
      const startTime = s.data?.startTime as number | undefined
      return s.status === "scheduled" && startTime && startTime > now
    }).sort((a: Doc<"entities">, b: Doc<"entities">) => {
      const aTime = (a.data?.startTime as number) || 0
      const bTime = (b.data?.startTime as number) || 0
      return aTime - bTime
    })
  }, [sessions])

  if (sessions === undefined) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-content-primary mb-6">Upcoming Sessions</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-content-primary">Upcoming Sessions</h1>
        <p className="text-content-secondary">View your children's scheduled tutoring sessions</p>
      </div>

      {upcomingSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-content-tertiary" />
            <h3 className="text-lg font-medium text-content-primary">No upcoming sessions</h3>
            <p className="mt-1 text-content-secondary">
              There are no scheduled sessions at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {upcomingSessions.map((session: Doc<"entities">) => (
            <SessionCard key={session._id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}
