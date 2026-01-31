"use client"

import { TeacherOnly } from "@/components/role-redirect"

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TeacherOnly>{children}</TeacherOnly>
}
