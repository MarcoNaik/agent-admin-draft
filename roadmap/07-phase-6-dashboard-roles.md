# Phase 6: Dashboard Role Modules

## Document Purpose

This document details the implementation of role-aware dashboard modules. By the end of this phase, different users see different interfaces based on their role, and all data displayed is permission-filtered.

**Status**: 📋 Planned

**Dependencies**: Phase 5 (Integration Layer)

**Estimated Scope**: Teacher module (~300 lines), Admin module (~400 lines), shared components (~200 lines)

---

## Context: Why Role-Based UI Matters

### The Current Dashboard State

The existing dashboard (`apps/dashboard`) is designed for developers/admins:
- Shows all agents, entities, jobs
- Full CRUD on everything
- No role-based filtering
- No specialized views for operational roles

### The Problem for Tutoring

When the tutoring platform launches:
- **Teachers** need to see their sessions, submit reports
- **Admins** need operational overview, issue management
- **Guardians** (future) might need a self-service portal

Without role-based UI:
- Teachers see irrelevant admin controls
- Teachers might see data they shouldn't (even if backend filters it)
- UX is confusing and unprofessional

### The Principle: Backend-Filtered, UI-Adapted

The backend (Phase 2-3) already filters data by permission. The UI's job is:
1. **Not show controls for unavailable actions**
2. **Present relevant workflows prominently**
3. **Hide administrative complexity from operational users**

The UI does NOT do permission filtering—it trusts the backend.

---

## Goals

By the end of Phase 6:

1. **Role detection in dashboard** - Know if user is admin, teacher, etc.
2. **Teacher module exists** - Focused view for teachers
3. **Admin module exists** - Full operational control
4. **Navigation adapts to role** - Different sidebar for different roles
5. **Actions respect permissions** - Don't show buttons for unauthorized actions
6. **Integration settings UI** - Admins can configure WhatsApp, Flow

---

## Non-Goals for This Phase

1. **Guardian portal** - Out of scope (consider for Phase 8)
2. **White-labeling** - Custom branding per org
3. **Mobile-responsive overhaul** - Basic responsiveness only
4. **Real-time notifications** - Push notifications, etc.

---

## Architecture

### Role Detection

The dashboard needs to know the current user's role:

```typescript
// hooks/use-current-role.ts
export function useCurrentRole(): {
  role: "admin" | "teacher" | "guardian" | "member"
  isLoading: boolean
} {
  const currentUser = useCurrentUser()
  const userRoles = useUserRoles(currentUser?._id)

  if (!currentUser || !userRoles) {
    return { role: "member", isLoading: true }
  }

  // Check for specific roles
  const hasAdminRole = userRoles.some(ur =>
    ur.role.name === "admin" || ur.role.isSystem
  )
  const hasTeacherRole = userRoles.some(ur =>
    ur.role.name === "teacher"
  )
  const hasGuardianRole = userRoles.some(ur =>
    ur.role.name === "guardian"
  )

  if (hasAdminRole) return { role: "admin", isLoading: false }
  if (hasTeacherRole) return { role: "teacher", isLoading: false }
  if (hasGuardianRole) return { role: "guardian", isLoading: false }

  return { role: "member", isLoading: false }
}
```

### Module Routing

Based on role, show different default views:

```typescript
// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }) {
  const { role, isLoading } = useCurrentRole()

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="flex">
      <Sidebar role={role} />
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
```

### Sidebar Navigation by Role

```typescript
// components/sidebar.tsx
const adminNavItems = [
  { label: "Dashboard", href: "/", icon: HomeIcon },
  { label: "Agents", href: "/agents", icon: BotIcon },
  { label: "Sessions", href: "/sessions", icon: CalendarIcon },
  { label: "Teachers", href: "/teachers", icon: UsersIcon },
  { label: "Students", href: "/students", icon: GraduationIcon },
  { label: "Payments", href: "/payments", icon: CreditCardIcon },
  { label: "Jobs", href: "/jobs", icon: ClockIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
]

const teacherNavItems = [
  { label: "My Sessions", href: "/teacher/sessions", icon: CalendarIcon },
  { label: "My Students", href: "/teacher/students", icon: UsersIcon },
  { label: "Submit Report", href: "/teacher/reports", icon: FileTextIcon },
  { label: "My Profile", href: "/teacher/profile", icon: UserIcon },
]

const guardianNavItems = [
  { label: "My Children", href: "/guardian/students", icon: UsersIcon },
  { label: "Upcoming Sessions", href: "/guardian/sessions", icon: CalendarIcon },
  { label: "Payments", href: "/guardian/payments", icon: CreditCardIcon },
  { label: "My Profile", href: "/guardian/profile", icon: UserIcon },
]

export function Sidebar({ role }: { role: string }) {
  const navItems =
    role === "admin" ? adminNavItems :
    role === "teacher" ? teacherNavItems :
    role === "guardian" ? guardianNavItems :
    []

  return (
    <nav className="w-64 bg-gray-900 p-4">
      {navItems.map(item => (
        <NavLink key={item.href} href={item.href}>
          <item.icon className="w-5 h-5 mr-2" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

---

## Teacher Module

### Teacher Session List

**Route**: `/teacher/sessions`

**Features**:
- List of teacher's own sessions (backend-filtered)
- Filter by status (upcoming, completed, cancelled)
- Quick actions: view details, submit report

```typescript
// app/(dashboard)/teacher/sessions/page.tsx
export default function TeacherSessionsPage() {
  const sessions = useEntities("session")  // Backend returns only teacher's sessions
  const [statusFilter, setStatusFilter] = useState<string>("upcoming")

  const filteredSessions = sessions?.filter(s => {
    if (statusFilter === "upcoming") {
      return s.data.status === "scheduled" && s.data.startTime > Date.now()
    }
    if (statusFilter === "completed") {
      return s.data.status === "completed"
    }
    return true
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My Sessions</h1>

      <div className="mb-4 flex gap-2">
        <FilterButton
          active={statusFilter === "upcoming"}
          onClick={() => setStatusFilter("upcoming")}
        >
          Upcoming
        </FilterButton>
        <FilterButton
          active={statusFilter === "completed"}
          onClick={() => setStatusFilter("completed")}
        >
          Completed
        </FilterButton>
        <FilterButton
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        >
          All
        </FilterButton>
      </div>

      <SessionTable sessions={filteredSessions} showReportAction />
    </div>
  )
}
```

### Teacher Session Detail

**Route**: `/teacher/sessions/[id]`

**Features**:
- Session details (time, student, subject)
- Meeting link (prominent)
- Notes field (editable)
- Report submission form

```typescript
// app/(dashboard)/teacher/sessions/[id]/page.tsx
export default function TeacherSessionDetailPage({ params }) {
  const session = useEntity(params.id)
  const student = useEntity(session?.data.studentId)
  const updateSession = useUpdateEntity()

  if (!session) return <NotFound />

  const isPast = session.data.startTime < Date.now()
  const needsReport = isPast && !session.data.reportSubmitted

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Session Details</h1>

      <Card className="mb-4">
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-gray-500">Student</dt>
              <dd className="font-medium">{student?.data.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Subject</dt>
              <dd className="font-medium">{session.data.subject}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Date & Time</dt>
              <dd className="font-medium">
                {formatDateTime(session.data.startTime)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Duration</dt>
              <dd className="font-medium">{session.data.duration} minutes</dd>
            </div>
          </dl>

          {session.data.meetingLink && (
            <a
              href={session.data.meetingLink}
              target="_blank"
              className="mt-4 block w-full bg-blue-600 text-white text-center py-3 rounded-lg"
            >
              Join Meeting
            </a>
          )}
        </CardContent>
      </Card>

      {needsReport && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Session Report</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportForm sessionId={params.id} />
          </CardContent>
        </Card>
      )}

      {session.data.reportSubmitted && (
        <Card>
          <CardHeader>
            <CardTitle>Session Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{session.data.reportContent}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### Teacher Report Form

```typescript
// components/teacher/report-form.tsx
export function ReportForm({ sessionId }: { sessionId: string }) {
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const updateSession = useUpdateEntity()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await updateSession({
        id: sessionId,
        data: {
          reportContent: content,
          reportSubmitted: true,
        },
        status: "completed",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Describe what was covered in the session, student progress, and any notes for parents..."
        className="w-full h-40 p-3 border rounded-lg"
        required
      />
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Report"}
      </button>
    </form>
  )
}
```

### Teacher Profile

**Route**: `/teacher/profile`

Shows and allows editing of teacher's own profile (within allowed fields).

---

## Admin Module

### Admin Dashboard (Home)

**Route**: `/`

**Features**:
- Key metrics overview
- Upcoming sessions (all)
- Recent issues/alerts
- Quick actions

```typescript
// app/(dashboard)/page.tsx
export default function AdminDashboard() {
  const { role } = useCurrentRole()

  if (role === "teacher") {
    redirect("/teacher/sessions")
  }
  if (role === "guardian") {
    redirect("/guardian/sessions")
  }

  return <AdminDashboardContent />
}

function AdminDashboardContent() {
  const sessions = useEntities("session")
  const payments = useEntities("payment")
  const jobStats = useJobStats()

  const upcomingSessions = sessions?.filter(
    s => s.data.status === "scheduled" && s.data.startTime > Date.now()
  ).slice(0, 5)

  const pendingPayments = payments?.filter(
    p => p.data.status === "pending"
  )

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Upcoming Sessions"
          value={upcomingSessions?.length || 0}
        />
        <MetricCard
          label="Pending Payments"
          value={pendingPayments?.length || 0}
          alert={pendingPayments?.length > 0}
        />
        <MetricCard
          label="Active Teachers"
          value={teachers?.length || 0}
        />
        <MetricCard
          label="Jobs Today"
          value={jobStats?.completedToday || 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionList sessions={upcomingSessions} compact />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentList payments={pendingPayments} compact />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### Admin Sessions Management

**Route**: `/sessions`

**Features**:
- All sessions (all teachers)
- Advanced filters (date range, teacher, status)
- Create new session
- Bulk actions

### Admin Teachers Management

**Route**: `/teachers`

**Features**:
- List all teachers
- View availability
- Edit teacher profiles
- Assign roles

### Admin Settings

**Route**: `/settings`

**Sections**:
- Organization settings
- Integration configuration
- Role management
- API keys

---

## Integration Settings UI

### WhatsApp Configuration

**Route**: `/settings/integrations/whatsapp`

```typescript
export default function WhatsAppSettingsPage() {
  const config = useIntegrationConfig("whatsapp")
  const updateConfig = useUpdateIntegrationConfig()
  const testConnection = useTestConnection()

  const [form, setForm] = useState({
    phoneNumberId: config?.config.phoneNumberId || "",
    accessToken: "",  // Don't show existing token
    businessAccountId: config?.config.businessAccountId || "",
  })

  const handleSave = async () => {
    await updateConfig({
      provider: "whatsapp",
      config: form,
    })
  }

  const handleTest = async () => {
    const result = await testConnection({ provider: "whatsapp" })
    if (result.success) {
      toast.success("Connection successful!")
    } else {
      toast.error(`Connection failed: ${result.error}`)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">WhatsApp Integration</h1>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label>Phone Number ID</Label>
            <Input
              value={form.phoneNumberId}
              onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
              placeholder="Enter your WhatsApp Business Phone Number ID"
            />
          </div>

          <div>
            <Label>Access Token</Label>
            <Input
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              placeholder="Enter your access token (leave blank to keep existing)"
            />
          </div>

          <div>
            <Label>Business Account ID</Label>
            <Input
              value={form.businessAccountId}
              onChange={(e) => setForm({ ...form, businessAccountId: e.target.value })}
              placeholder="Enter your WhatsApp Business Account ID"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave}>Save Configuration</Button>
            <Button variant="outline" onClick={handleTest}>Test Connection</Button>
          </div>

          {config?.status === "active" && (
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              Connected
            </div>
          )}

          {config?.status === "error" && (
            <div className="flex items-center text-red-600">
              <XCircle className="w-4 h-4 mr-2" />
              Connection Error
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Message Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsAppTemplateList />
        </CardContent>
      </Card>
    </div>
  )
}
```

### Payment Configuration

**Route**: `/settings/integrations/payments`

Similar structure for Flow configuration.

---

## Permission-Aware Actions

### Conditional Action Buttons

Don't show buttons for actions the user can't perform:

```typescript
// components/session-actions.tsx
export function SessionActions({ session }: { session: Session }) {
  const { role } = useCurrentRole()
  const deleteSession = useDeleteEntity()

  const canEdit = role === "admin" || session.data.teacherId === currentUserId
  const canDelete = role === "admin"
  const canSubmitReport = role === "teacher" && !session.data.reportSubmitted

  return (
    <div className="flex gap-2">
      {canEdit && (
        <Button variant="outline" onClick={() => openEditModal(session)}>
          Edit
        </Button>
      )}

      {canSubmitReport && (
        <Button onClick={() => openReportModal(session)}>
          Submit Report
        </Button>
      )}

      {canDelete && (
        <Button variant="destructive" onClick={() => deleteSession(session._id)}>
          Delete
        </Button>
      )}
    </div>
  )
}
```

### Error Handling for Permission Denials

When an action fails due to permissions:

```typescript
const handleAction = async () => {
  try {
    await performAction()
  } catch (error) {
    if (error.message.includes("Permission denied")) {
      toast.error("You don't have permission to perform this action")
    } else {
      toast.error("An error occurred")
    }
  }
}
```

---

## Testing Strategy

### Role Detection Tests

1. **Admin role detected**
   - User has admin role
   - Assert useCurrentRole returns "admin"

2. **Teacher role detected**
   - User has teacher role only
   - Assert useCurrentRole returns "teacher"

3. **Role priority**
   - User has both admin and teacher
   - Assert admin takes precedence

### Navigation Tests

1. **Admin sees admin nav**
   - Login as admin
   - Assert all admin nav items visible

2. **Teacher sees teacher nav**
   - Login as teacher
   - Assert only teacher nav items visible

3. **Redirect on role mismatch**
   - Teacher navigates to /settings
   - Assert redirect to /teacher/sessions

### Data Display Tests

1. **Teacher sees only own sessions**
   - Backend returns filtered data
   - Assert UI displays only returned data

2. **Field masking respected**
   - Session without payment fields
   - Assert payment info not displayed

---

## Success Criteria

Phase 6 is complete when:

1. ✅ `useCurrentRole` correctly identifies user role
2. ✅ Sidebar shows role-appropriate navigation
3. ✅ Teacher module pages exist and work
4. ✅ Admin module pages exist and work
5. ✅ Action buttons respect permissions
6. ✅ Integration settings UI works for WhatsApp and Flow
7. ✅ Permission denial errors are handled gracefully
8. ✅ All tests pass

---

## Files Created/Modified

| Path | Changes |
|------|---------|
| `apps/dashboard/src/hooks/use-current-role.ts` | NEW: Role detection hook |
| `apps/dashboard/src/components/sidebar.tsx` | Role-based navigation |
| `apps/dashboard/src/app/(dashboard)/layout.tsx` | Role context |
| `apps/dashboard/src/app/(dashboard)/teacher/*` | NEW: Teacher module pages |
| `apps/dashboard/src/app/(dashboard)/settings/integrations/*` | NEW: Integration settings |
| `apps/dashboard/src/components/teacher/*` | NEW: Teacher-specific components |

---

## What's Next: Phase 7

Phase 7 formalizes the pack system:

- Pack versioning and migrations
- Pack marketplace (future)
- Generic pack installation flow

See [08-phase-7-pack-system.md](./08-phase-7-pack-system.md) for details.
