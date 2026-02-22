"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Loader2 } from "lucide-react"
import { useEntities } from "@/hooks/use-convex-data"
import { useEnvironment } from "@/contexts/environment-context"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Doc } from "@convex/_generated/dataModel"

export default function GuardianStudentsPage() {
  const router = useRouter()
  const { environment } = useEnvironment()
  const students = useEntities("student", environment)

  const activeStudents = useMemo(() => {
    if (!students) return []
    return students.filter((s: Doc<"entities">) => s.status === "active")
  }, [students])

  if (students === undefined) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-display font-semibold text-content-primary mb-6">My Children</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-content-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-display font-semibold text-content-primary">My Children</h1>
        <p className="text-content-secondary">View your children's profiles</p>
      </div>

      {activeStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-content-tertiary" />
            <h3 className="text-lg font-medium text-content-primary">No students found</h3>
            <p className="mt-1 text-content-secondary">
              You do not have any students registered yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeStudents.map((student: Doc<"entities">) => {
            const name = student.data?.name as string | undefined
            const grade = student.data?.grade as string | undefined
            const subjects = student.data?.subjects as string[] | undefined

            return (
              <Card
                key={student._id}
                className="cursor-pointer hover:bg-background-tertiary transition-colors ease-out-soft"
                onClick={() => router.push(`/entities/student/${student._id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-content-primary truncate">
                        {name || "Student"}
                      </h3>
                      {grade && (
                        <p className="text-sm text-content-secondary">Grade {grade}</p>
                      )}
                      {subjects && subjects.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {subjects.slice(0, 3).map((subject) => (
                            <Badge key={subject} variant="secondary" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
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
