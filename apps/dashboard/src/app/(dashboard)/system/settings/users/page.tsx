"use client"

import { UsersPanel } from "@/components/users-panel"

export default function UsersPage() {
  return <UsersPanel permissions={{ canCreate: true, canUpdate: true, canDelete: true, isAdmin: true }} />
}
