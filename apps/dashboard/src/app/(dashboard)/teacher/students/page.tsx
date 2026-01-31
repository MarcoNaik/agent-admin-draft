"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Mail, Phone, Loader2 } from "lucide-react"
import { useEntities } from "@/hooks/use-convex-data"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Doc } from "@convex/_generated/dataModel"

export default function TeacherStudentsPage() {
  const router = useRouter()
  const students = useEntities("student")

  const activeStudents = useMemo(() => {
    if (!students) return []
    return students.filter((s: Doc<"entities">) => s.status === "active")
  }, [students])

  if (students === undefined) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-content-primary mb-6">My Students</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-content-primary">My Students</h1>
        <p className="text-content-secondary">Students assigned to you</p>
      </div>

      {activeStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-content-tertiary" />
            <h3 className="text-lg font-medium text-content-primary">No students found</h3>
            <p className="mt-1 text-content-secondary">
              You do not have any students assigned yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeStudents.map((student: Doc<"entities">) => {
            const name = student.data?.name as string | undefined
            const email = student.data?.email as string | undefined
            const phone = student.data?.phone as string | undefined
            const grade = student.data?.grade as string | undefined
            const subjects = student.data?.subjects as string[] | undefined

            return (
              <Card
                key={student._id}
                className="cursor-pointer hover:bg-background-tertiary transition-colors"
                onClick={() => router.push(`/entities/student/${student._id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-content-primary truncate">
                        {name || "Unknown Student"}
                      </h3>
                      {grade && (
                        <p className="text-sm text-content-secondary">Grade {grade}</p>
                      )}
                      <div className="mt-2 space-y-1">
                        {email && (
                          <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate">{email}</span>
                          </div>
                        )}
                        {phone && (
                          <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{phone}</span>
                          </div>
                        )}
                      </div>
                      {subjects && subjects.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {subjects.slice(0, 3).map((subject) => (
                            <Badge key={subject} variant="secondary" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                          {subjects.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{subjects.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
