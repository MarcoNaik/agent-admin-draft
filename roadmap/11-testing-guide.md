# End-to-End Testing Guide

## Prerequisites

### 1. Start Services

```bash
# Terminal 1: Start Convex backend
cd platform/convex
npx convex dev

# Terminal 2: Start Dashboard
cd apps/dashboard
bun run dev

# Terminal 3 (optional): Start Tool Executor
cd platform/tool-executor
bun run dev
```

### 2. Access Dashboard

Open http://localhost:3000 and sign in with Clerk.

---

## Test 1: Install Tutoring Pack

### Steps

1. Go to **Settings** → **Solution Packs**
2. Find "Tutoring Operations" pack
3. Click **Install Pack**
4. Confirm installation

### Expected Results

- 6 entity types created (Teacher, Student, Guardian, Session, Payment, Entitlement)
- 3 roles created (admin, teacher, guardian)
- Policies, scope rules, and field masks configured
- Pack shows as "Installed (v1.0.0)"

### Verify in Convex Dashboard

```
https://dashboard.convex.dev
```

Check tables:
- `entityTypes` - Should have 6 new types
- `roles` - Should have admin, teacher, guardian
- `policies` - Should have role-specific policies
- `scopeRules` - Should have teacher/guardian scopes
- `fieldMasks` - Should have field visibility rules

---

## Test 2: Create Test Data

### Create via Convex Dashboard or API

#### Create a Teacher

```typescript
// In Convex Dashboard → Functions → entities:create
{
  "entityTypeSlug": "teacher",
  "data": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+1234567890",
    "subjects": ["Math", "Physics"],
    "availability": [
      { "dayOfWeek": 1, "startHour": 9, "endHour": 17 },
      { "dayOfWeek": 3, "startHour": 9, "endHour": 17 }
    ],
    "hourlyRate": 50,
    "userId": "user_teacher_123"
  }
}
```

#### Create a Guardian

```typescript
{
  "entityTypeSlug": "guardian",
  "data": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+0987654321",
    "whatsappNumber": "+0987654321",
    "userId": "user_guardian_456"
  }
}
```

#### Create a Student (linked to Guardian)

```typescript
{
  "entityTypeSlug": "student",
  "data": {
    "name": "Tommy Doe",
    "grade": "5th Grade",
    "subjects": ["Math"],
    "guardianId": "<guardian_entity_id>",
    "notes": "Internal notes - should be hidden from teacher"
  }
}
```

---

## Test 3: Permission Engine

### Test 3.1: Role Assignment

1. Go to Convex Dashboard
2. Insert into `userRoles`:

```typescript
{
  "userId": "<your_clerk_user_id>",
  "roleId": "<teacher_role_id>",
  "assignedBy": "<admin_user_id>",
  "assignedAt": Date.now()
}
```

### Test 3.2: Scope Filtering

With teacher role assigned:

1. Create sessions for multiple teachers
2. Query `entities:list` with `entityTypeSlug: "session"`
3. **Expected**: Only sessions where `teacherId` matches your user

### Test 3.3: Field Masking

1. Create a session with all fields including `paymentId`, `guardianNotes`
2. Query as teacher
3. **Expected**: `paymentId`, `guardianId`, `guardianNotes` should NOT appear

### Test 3.4: Admin Override

1. Assign admin role to your user
2. Query sessions
3. **Expected**: See ALL sessions with ALL fields

---

## Test 4: Session Scheduling

### Test 4.1: Create Session with Constraints

```typescript
// sessions:createSession
{
  "teacherId": "<teacher_entity_id>",
  "studentId": "<student_entity_id>",
  "guardianId": "<guardian_entity_id>",
  "startTime": Date.now() + (48 * 60 * 60 * 1000), // 48 hours from now
  "duration": 60,
  "subject": "Math"
}
```

**Expected**: Session created with status "pending_payment"

### Test 4.2: Booking Lead Time Violation

```typescript
{
  "startTime": Date.now() + (12 * 60 * 60 * 1000) // 12 hours (< 24h minimum)
}
```

**Expected**: Error "Sessions must be booked at least 24 hours in advance"

### Test 4.3: Double Booking Prevention

1. Create session for teacher at 3pm Monday
2. Try to create another session for same teacher at 3pm Monday

**Expected**: Error "Teacher already has a session at this time"

### Test 4.4: Teacher Availability Check

1. Create session outside teacher's availability hours

**Expected**: Error "Teacher is not available at this time"

---

## Test 5: Session Lifecycle

### Test 5.1: Payment Confirmation

```typescript
// payments:markAsPaid (internal - simulate webhook)
{
  "providerReference": "<flow_order_id>",
  "paidAt": Date.now()
}
```

**Expected**:
- Payment status → "paid"
- Session status → "scheduled"
- Event emitted: "session.confirmed"

### Test 5.2: Session Completion

```typescript
// sessions:completeSession
{
  "sessionId": "<session_id>",
  "reportContent": "Student showed great progress in algebra..."
}
```

**Expected**:
- Session status → "completed"
- `reportSubmitted: true`
- If linked to entitlement: credit consumed
- Follow-up job scheduled

### Test 5.3: Session Cancellation

```typescript
// sessions:cancelSession
{
  "sessionId": "<session_id>",
  "reason": "Student sick"
}
```

**Expected**:
- Session status → "cancelled"
- `cancellationReason` set
- Reminder jobs cancelled

---

## Test 6: Credit/Entitlement System

### Test 6.1: Create Entitlement

```typescript
{
  "entityTypeSlug": "entitlement",
  "data": {
    "guardianId": "<guardian_id>",
    "studentId": "<student_id>",
    "totalCredits": 4,
    "remainingCredits": 4,
    "usedCredits": 0,
    "status": "active",
    "expiresAt": Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  }
}
```

### Test 6.2: Credit Consumption

1. Create session linked to entitlement
2. Complete session
3. Check entitlement

**Expected**:
- `remainingCredits`: 3
- `usedCredits`: 1

### Test 6.3: Credit Exhaustion

1. Use all credits
2. Check entitlement status

**Expected**: `status: "exhausted"`

---

## Test 7: Job System

### Test 7.1: Reminder Job Scheduling

1. Create session 48 hours in future
2. Check `jobs` table

**Expected**:
- Job type "session.reminder" scheduled for 20 hours before session
- Job has `actorContext` with creator's identity

### Test 7.2: Job Execution

Wait for scheduled time or manually trigger:

```typescript
// jobs:execute (internal)
{
  "jobId": "<job_id>"
}
```

**Expected**:
- Job status → "completed"
- Event emitted for reminder

---

## Test 8: Dashboard Role Views

### Test 8.1: Admin View

1. Assign admin role
2. Refresh dashboard

**Expected Navigation**:
- Agents
- Packs
- Settings (with Integrations)
- Business menu (Sessions, Teachers, Students, etc.)

### Test 8.2: Teacher View

1. Remove admin role, assign teacher role
2. Refresh dashboard

**Expected Navigation**:
- My Sessions
- My Students
- My Profile

**Expected Data**:
- Only own sessions visible
- No payment information visible
- Can submit reports

### Test 8.3: Guardian View

1. Assign guardian role
2. Refresh dashboard

**Expected Navigation**:
- Sessions (children's)
- My Children
- Payments
- My Profile

---

## Test 9: Integration Settings (Admin Only)

### Test 9.1: WhatsApp Configuration

1. Go to Settings → Integrations → WhatsApp
2. Enter test credentials:
   - Phone Number ID: `test_phone_id`
   - Access Token: `test_token`
   - Business Account ID: `test_account`
3. Click Save
4. Click Test Connection

**Expected**: Config saved to `integrationConfigs` table

### Test 9.2: Flow Payment Configuration

1. Go to Settings → Integrations → Payments
2. Enter test credentials
3. Save

**Expected**: Webhook URLs displayed for Flow configuration

---

## Test 10: WhatsApp Integration (if configured)

### Test 10.1: Template Message

```typescript
// whatsapp:sendTemplate
{
  "toPhoneNumber": "+1234567890",
  "templateName": "session_reminder",
  "languageCode": "es",
  "variables": {
    "guardianName": "Jane",
    "subject": "Math",
    "time": "3:00 PM",
    "teacherName": "John",
    "meetingLink": "https://meet.example.com/123"
  }
}
```

### Test 10.2: 24-Hour Window

1. Simulate inbound message (via webhook or direct insert)
2. Check `whatsappConversations` table
3. Verify `windowExpiresAt` is set to 24 hours from message

### Test 10.3: Freeform Message (within window)

```typescript
// whatsapp:sendMessage
{
  "toPhoneNumber": "+1234567890",
  "message": "Your session is confirmed!"
}
```

**Expected**: Success if within 24h window, error if outside

---

## Test 11: Pack Upgrade (Simulate)

### Test 11.1: Preview Upgrade

1. Modify tutoring pack version to "1.1.0"
2. Add a migration step
3. Call `packs:previewUpgrade`

**Expected**: Shows automatic changes and skipped customizations

### Test 11.2: Execute Upgrade

1. Call `packs:upgrade`
2. Check `installedPacks` record

**Expected**:
- Version updated
- `upgradeHistory` has new entry
- Customized items preserved

---

## Test 12: API Access

### Test 12.1: Create API Key

1. Go to Settings → API Keys
2. Create new key
3. Copy the key (shown only once)

### Test 12.2: Chat Endpoint

```bash
curl -X POST https://your-convex-url/v1/chat \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<agent_id>",
    "message": "Hello"
  }'
```

**Expected**: Agent response with tool execution respecting API key's permissions

---

## Automated Test Script

Create `test/e2e.ts`:

```typescript
import { ConvexHttpClient } from "convex/browser"
import { api } from "../platform/convex/_generated/api"

const client = new ConvexHttpClient(process.env.CONVEX_URL!)

async function runTests() {
  console.log("🧪 Starting E2E Tests\n")

  // Test 1: List entity types
  console.log("1. Checking entity types...")
  const types = await client.query(api.entityTypes.list, {})
  console.log(`   Found ${types.length} entity types`)

  // Test 2: Check roles
  console.log("2. Checking roles...")
  const roles = await client.query(api.roles.list, {})
  console.log(`   Found ${roles.length} roles`)

  // Test 3: Check installed packs
  console.log("3. Checking installed packs...")
  const packs = await client.query(api.packs.list, {})
  const installed = packs.filter(p => p.isInstalled)
  console.log(`   ${installed.length} packs installed`)

  console.log("\n✅ Basic checks passed")
}

runTests().catch(console.error)
```

Run with:
```bash
CONVEX_URL=https://your-deployment.convex.cloud npx ts-node test/e2e.ts
```

---

## Troubleshooting

### "No development configuration found"

Agent hasn't been synced. Run `struere dev` in agent project.

### Permission denied errors

1. Check user has role assigned in `userRoles`
2. Check role has policy for the resource/action
3. Check scope rules match the data

### Jobs not executing

1. Verify `scheduledFor` time has passed
2. Check job `status` is "pending"
3. Look for errors in Convex logs

### Dashboard shows no data

1. Check browser console for errors
2. Verify Clerk authentication
3. Check organization ID matches data

---

## Test Checklist

- [ ] Tutoring pack installed
- [ ] Entity types created (6)
- [ ] Roles created (3)
- [ ] Test data created (teacher, guardian, student)
- [ ] Role assignment working
- [ ] Scope filtering working (teacher sees own sessions)
- [ ] Field masking working (no payment info for teacher)
- [ ] Session scheduling constraints enforced
- [ ] Session lifecycle transitions work
- [ ] Credit consumption works
- [ ] Jobs scheduled correctly
- [ ] Dashboard shows role-appropriate views
- [ ] Integration settings saveable
- [ ] API access with key works
