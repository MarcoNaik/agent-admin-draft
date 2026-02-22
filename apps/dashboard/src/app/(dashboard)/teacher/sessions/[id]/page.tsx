"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Calendar, Clock, User, Video, Loader2, CheckCircle } from "lucide-react"
import { useEntity } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ReportForm } from "@/components/teacher/report-form"
import { SessionActions } from "@/components/teacher/session-actions"
import { Id } from "@convex/_generated/dataModel"

interface TeacherSessionDetailPageProps {
  params: { id: string }
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function TeacherSessionDetailPage({ params }: TeacherSessionDetailPageProps) {
  const router = useRouter()
  const { environment } = useEnvironment()
  const session = useEntity(params.id as Id<"entities">, environment)
  const studentId = session?.data?.studentId as Id<"entities"> | undefined
  const student = useEntity(studentId as Id<"entities">, environment)
  const [showReportForm, setShowReportForm] = useState(false)
  const reportFormRef = useRef<HTMLDivElement>(null)

  const startTime = session?.data?.startTime as number | undefined
  const duration = session?.data?.duration as number | undefined
  const subject = session?.data?.subject as string | undefined
  const meetingLink = session?.data?.meetingLink as string | undefined
  const notes = session?.data?.notes as string | undefined
  const reportContent = session?.data?.reportContent as string | undefined
  const reportSubmittedAt = session?.data?.reportSubmittedAt as number | undefined

  const isPast = startTime ? startTime < Date.now() : false
  const needsReport = isPast && !reportSubmittedAt

  useEffect(() => {
    if (showReportForm && reportFormRef.current) {
      reportFormRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [showReportForm])

  if (session === undefined) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  if (session === null) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium text-content-primary">Session not found</h3>
            <p className="mt-1 text-content-secondary">
              This session does not exist or you do not have access to it.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/teacher/sessions")}
            >
              Back to Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/teacher/sessions")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Sessions
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-semibold text-content-primary">Session Details</h1>
          <p className="text-content-secondary">
            {subject || "Tutoring Session"}
          </p>
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

      <Card className="mb-6 bg-background-secondary">
        <CardContent className="p-6">
          <dl className="grid grid-cols-2 gap-6">
            <div>
              <dt className="text-sm text-content-tertiary flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Student
              </dt>
              <dd className="mt-1 font-medium text-content-primary">
                {student?.data?.name || "Loading..."}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-content-tertiary">Subject</dt>
              <dd className="mt-1 font-medium text-content-primary">
                {subject || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-content-tertiary flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Date & Time
              </dt>
              <dd className="mt-1 font-medium text-content-primary">
                {startTime ? formatDateTime(startTime) : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-content-tertiary flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Duration
              </dt>
              <dd className="mt-1 font-medium text-content-primary">
                {duration ? `${duration} minutes` : "-"}
              </dd>
            </div>
          </dl>

          {meetingLink && !isPast && (
            <a
              href={meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 w-full bg-ocean hover:bg-ocean/80 text-white py-3 rounded-lg transition-colors ease-out-soft"
            >
              <Video className="h-5 w-5" />
              Join Meeting
            </a>
          )}
        </CardContent>
      </Card>

      {notes && (
        <Card className="mb-6 bg-background-secondary">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-content-primary">Session Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-content-secondary">{notes}</p>
          </CardContent>
        </Card>
      )}

      {reportSubmittedAt && reportContent && (
        <Card className="mb-6 bg-background-secondary border-success/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-content-primary flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Session Report
              </CardTitle>
              <span className="text-xs text-content-tertiary">
                Submitted {formatDate(reportSubmittedAt)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-content-secondary">{reportContent}</p>
          </CardContent>
        </Card>
      )}

      {needsReport && !showReportForm && (
        <Card className="mb-6 bg-amber/10 border-amber/20">
          <CardContent className="p-6 text-center">
            <p className="text-content-secondary mb-4">
              This session is complete but missing a report. Please submit your session report.
            </p>
            <Button onClick={() => setShowReportForm(true)}>
              Submit Report
            </Button>
          </CardContent>
        </Card>
      )}

      {showReportForm && (
        <div ref={reportFormRef}>
          <Card className="mb-6 bg-background-secondary">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-content-primary">Submit Session Report</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportForm
                sessionId={params.id as Id<"entities">}
                onSuccess={() => setShowReportForm(false)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-end">
        <SessionActions
          sessionId={params.id as Id<"entities">}
          sessionData={{
            teacherId: session.data?.teacherId as string | undefined,
            reportSubmittedAt,
            status: session.status,
          }}
          onReportClick={() => setShowReportForm(true)}
        />
      </div>
    </div>
  )
}
