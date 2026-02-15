const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"
const CLERK_BASE = "https://api.clerk.com/v1"

function getClerkSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY
  if (!key) throw new Error("CLERK_SECRET_KEY not configured")
  return key
}

export async function getGoogleAccessToken(clerkUserId: string): Promise<string> {
  const response = await fetch(
    `${CLERK_BASE}/users/${clerkUserId}/oauth_access_tokens/oauth_google`,
    {
      headers: {
        Authorization: `Bearer ${getClerkSecretKey()}`,
      },
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to get Google token from Clerk (${response.status}): ${text}`)
  }

  const data = (await response.json()) as Array<{ token: string }>
  if (!data.length || !data[0].token) {
    throw new Error("User has not connected Google OAuth or token is expired")
  }

  return data[0].token
}

export interface CalendarEvent {
  summary: string
  description?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  attendees?: Array<{ email: string }>
  status?: string
}

export interface CalendarEventResponse {
  id: string
  htmlLink: string
  summary: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  status: string
}

export async function listCalendarEvents(
  token: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  maxResults?: number
): Promise<{ items: CalendarEventResponse[] }> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  })
  if (maxResults) params.set("maxResults", String(maxResults))

  const response = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Calendar list events failed (${response.status}): ${text}`)
  }

  return (await response.json()) as { items: CalendarEventResponse[] }
}

export async function createCalendarEvent(
  token: string,
  calendarId: string,
  event: CalendarEvent
): Promise<CalendarEventResponse> {
  const response = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Calendar create event failed (${response.status}): ${text}`)
  }

  return (await response.json()) as CalendarEventResponse
}

export async function updateCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string,
  updates: Partial<CalendarEvent>
): Promise<CalendarEventResponse> {
  const response = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Calendar update event failed (${response.status}): ${text}`)
  }

  return (await response.json()) as CalendarEventResponse
}

export async function deleteCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!response.ok && response.status !== 410) {
    const text = await response.text()
    throw new Error(`Google Calendar delete event failed (${response.status}): ${text}`)
  }
}

export interface FreeBusySlot {
  start: string
  end: string
}

export async function getFreeBusy(
  token: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<{ busy: FreeBusySlot[] }> {
  const response = await fetch(`${CALENDAR_BASE}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Calendar freeBusy failed (${response.status}): ${text}`)
  }

  const data = (await response.json()) as {
    calendars: Record<string, { busy: FreeBusySlot[] }>
  }

  return { busy: data.calendars[calendarId]?.busy ?? [] }
}

export interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
  accessRole: string
}

export async function listCalendars(
  token: string
): Promise<{ items: CalendarListEntry[] }> {
  const response = await fetch(`${CALENDAR_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Calendar list calendars failed (${response.status}): ${text}`)
  }

  return (await response.json()) as { items: CalendarListEntry[] }
}
