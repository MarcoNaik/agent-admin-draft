import { QueryCtx } from "../_generated/server"
import { Id } from "../_generated/dataModel"

const MIN_BOOKING_LEAD_TIME_MS = 24 * 60 * 60 * 1000
const RESCHEDULE_CUTOFF_MS = 2 * 60 * 60 * 1000

interface AvailabilitySlot {
  dayOfWeek: number
  startHour: number
  endHour: number
}

interface TeacherData {
  availability?: AvailabilitySlot[]
}

interface SessionData {
  startTime: number
  duration: number
  teacherId: string
  status: string
}

export function validateBookingTime(startTime: number): void {
  const now = Date.now()
  const leadTimeMs = startTime - now

  if (leadTimeMs < MIN_BOOKING_LEAD_TIME_MS) {
    throw new Error("Sessions must be booked at least 24 hours in advance")
  }
}

export function validateReschedule(session: { data: SessionData }): void {
  const now = Date.now()
  const timeUntilStart = session.data.startTime - now

  if (timeUntilStart < RESCHEDULE_CUTOFF_MS) {
    throw new Error("Sessions can only be rescheduled up to 2 hours before start time")
  }
}

export function validateTeacherAvailability(
  teacher: { data: TeacherData },
  startTime: number,
  duration: number
): void {
  if (!teacher.data.availability || teacher.data.availability.length === 0) {
    return
  }

  const date = new Date(startTime)
  const dayOfWeek = date.getDay()
  const startHour = date.getHours()
  const endHour = startHour + Math.ceil(duration / 60)

  const availableSlot = teacher.data.availability.find(
    (slot) =>
      slot.dayOfWeek === dayOfWeek &&
      slot.startHour <= startHour &&
      slot.endHour >= endHour
  )

  if (!availableSlot) {
    throw new Error("Teacher is not available at this time")
  }
}

export async function validateNoOverlap(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  teacherId: string,
  startTime: number,
  duration: number,
  excludeSessionId?: Id<"entities">
): Promise<void> {
  const endTime = startTime + duration * 60 * 1000

  const sessionType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", "session")
    )
    .first()

  if (!sessionType) {
    return
  }

  const allSessions = await ctx.db
    .query("entities")
    .withIndex("by_org_type", (q) =>
      q.eq("organizationId", organizationId).eq("entityTypeId", sessionType._id)
    )
    .collect()

  const teacherSessions = allSessions.filter((s) => {
    const data = s.data as SessionData
    return (
      data.teacherId === teacherId &&
      data.status !== "cancelled" &&
      data.status !== "no_show" &&
      (!excludeSessionId || s._id !== excludeSessionId) &&
      !s.deletedAt
    )
  })

  for (const session of teacherSessions) {
    const data = session.data as SessionData
    const sessionStart = data.startTime
    const sessionEnd = sessionStart + data.duration * 60 * 1000

    if (startTime < sessionEnd && endTime > sessionStart) {
      throw new Error("Teacher already has a session at this time")
    }
  }
}

export function validateSessionTransition(
  currentStatus: string,
  newStatus: string
): void {
  const validTransitions: Record<string, string[]> = {
    pending_payment: ["scheduled", "cancelled"],
    scheduled: ["in_progress", "cancelled", "no_show"],
    in_progress: ["completed"],
    completed: [],
    cancelled: [],
    no_show: [],
  }

  const allowed = validTransitions[currentStatus] || []

  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid session status transition from ${currentStatus} to ${newStatus}`
    )
  }
}

export function calculateSessionEndTime(startTime: number, durationMinutes: number): number {
  return startTime + durationMinutes * 60 * 1000
}

export function isWithinRescheduleCutoff(startTime: number): boolean {
  const now = Date.now()
  return startTime - now < RESCHEDULE_CUTOFF_MS
}

export function isWithinBookingLeadTime(startTime: number): boolean {
  const now = Date.now()
  return startTime - now < MIN_BOOKING_LEAD_TIME_MS
}
