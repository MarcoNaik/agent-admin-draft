import { defineTools } from '@struere/core'
import type { ToolContext } from '@struere/core'

interface SessionBookingParams {
  studentId: string
  teacherId: string
  subject: string
  scheduledAt: string
  durationMinutes: number
  location?: string
  notes?: string
}

interface AvailableSlotsParams {
  teacherId: string
  date: string
  durationMinutes?: number
}

interface CancelSessionParams {
  sessionId: string
  reason: string
}

interface CompleteSessionParams {
  sessionId: string
  feedback?: {
    teacherNotes?: string
    topicsCovered?: string[]
    homework?: string
    studentProgress?: 'needs_improvement' | 'satisfactory' | 'good' | 'excellent'
  }
  notes?: string
}

interface CheckEntitlementParams {
  studentId: string
}

interface CreatePaymentLinkParams {
  guardianId: string
  amount: number
  description: string
  sessionId?: string
  packType?: 'single_session' | 'pack_5' | 'pack_10' | 'pack_20' | 'monthly_unlimited' | 'custom'
}

interface ProcessPaymentParams {
  paymentId: string
  externalId: string
  status: 'completed' | 'failed'
}

async function callBuiltinTool(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const toolHandler = (ctx as unknown as { builtinTools: Record<string, { handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown> }> }).builtinTools?.[toolName]
  if (toolHandler) {
    return toolHandler.handler(args, ctx)
  }
  throw new Error(`Built-in tool ${toolName} not available`)
}

export const tutoringTools = defineTools([
  {
    name: 'book_session',
    description: 'Book a tutoring session for a student with a teacher. Validates availability, creates session entity, links to student and teacher, and schedules a reminder.',
    parameters: {
      studentId: {
        type: 'string',
        description: 'ID of the student entity',
        required: true
      },
      teacherId: {
        type: 'string',
        description: 'ID of the teacher entity',
        required: true
      },
      subject: {
        type: 'string',
        description: 'Subject being taught (e.g., "Math", "Physics")',
        required: true
      },
      scheduledAt: {
        type: 'string',
        description: 'ISO datetime for the session start time',
        required: true
      },
      durationMinutes: {
        type: 'number',
        description: 'Duration of the session in minutes (default: 60)',
        required: false
      },
      location: {
        type: 'string',
        description: 'Location or meeting link (optional)',
        required: false
      },
      notes: {
        type: 'string',
        description: 'Pre-session notes (optional)',
        required: false
      }
    },
    handler: async (params: Record<string, unknown>, ctx: ToolContext) => {
      const args = params as SessionBookingParams

      const studentResult = await callBuiltinTool(ctx, 'entity.get', { id: args.studentId }) as { entity?: { id: string; status: string; data: Record<string, unknown> } }
      if (!studentResult.entity) {
        throw new Error(`Student not found: ${args.studentId}`)
      }
      if (studentResult.entity.status !== 'active') {
        throw new Error(`Student is not active: ${studentResult.entity.status}`)
      }

      const teacherResult = await callBuiltinTool(ctx, 'entity.get', { id: args.teacherId }) as { entity?: { id: string; status: string; data: Record<string, unknown> } }
      if (!teacherResult.entity) {
        throw new Error(`Teacher not found: ${args.teacherId}`)
      }
      if (teacherResult.entity.status !== 'available') {
        throw new Error(`Teacher is not available: ${teacherResult.entity.status}`)
      }

      const scheduledDate = new Date(args.scheduledAt)
      const endDate = new Date(scheduledDate.getTime() + (args.durationMinutes || 60) * 60 * 1000)

      const existingSessions = await callBuiltinTool(ctx, 'entity.query', {
        type: 'session',
        filters: {
          idx_date_0_gte: scheduledDate.toISOString(),
          idx_date_0_lte: endDate.toISOString()
        },
        status: 'confirmed'
      }) as { entities?: Array<{ id: string }> }

      const sessionResult = await callBuiltinTool(ctx, 'entity.create', {
        type: 'session',
        data: {
          subject: args.subject,
          scheduledAt: args.scheduledAt,
          durationMinutes: args.durationMinutes || 60,
          location: args.location || null,
          notes: args.notes || null
        },
        status: 'scheduled'
      }) as { entity: { id: string; data: Record<string, unknown> } }

      const sessionId = sessionResult.entity.id

      await callBuiltinTool(ctx, 'entity.link', {
        fromId: sessionId,
        toId: args.studentId,
        relationType: 'scheduled_for'
      })

      await callBuiltinTool(ctx, 'entity.link', {
        fromId: sessionId,
        toId: args.teacherId,
        relationType: 'taught_by'
      })

      const reminderTime = new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000)
      if (reminderTime > new Date()) {
        await callBuiltinTool(ctx, 'job.enqueue', {
          jobType: 'send_session_reminder',
          payload: {
            sessionId,
            reminderType: '24h'
          },
          entityId: sessionId,
          scheduledFor: reminderTime.toISOString(),
          idempotencyKey: `reminder:${sessionId}:24h`
        })
      }

      await callBuiltinTool(ctx, 'event.emit', {
        entityId: sessionId,
        eventType: 'session.created',
        payload: {
          studentId: args.studentId,
          teacherId: args.teacherId,
          subject: args.subject,
          scheduledAt: args.scheduledAt
        }
      })

      return {
        success: true,
        session: {
          id: sessionId,
          subject: args.subject,
          scheduledAt: args.scheduledAt,
          durationMinutes: args.durationMinutes || 60,
          location: args.location,
          studentId: args.studentId,
          teacherId: args.teacherId,
          status: 'scheduled'
        },
        reminderScheduled: reminderTime > new Date()
      }
    }
  },

  {
    name: 'get_available_slots',
    description: 'Get available time slots for a teacher on a given date based on their availability configuration and existing sessions.',
    parameters: {
      teacherId: {
        type: 'string',
        description: 'ID of the teacher entity',
        required: true
      },
      date: {
        type: 'string',
        description: 'Date to check (YYYY-MM-DD format)',
        required: true
      },
      durationMinutes: {
        type: 'number',
        description: 'Required session duration (default: 60)',
        required: false
      }
    },
    handler: async (params: Record<string, unknown>, ctx: ToolContext) => {
      const args = params as AvailableSlotsParams
      const duration = args.durationMinutes || 60

      const teacherResult = await callBuiltinTool(ctx, 'entity.get', { id: args.teacherId }) as { entity?: { id: string; status: string; data: { availability?: Record<string, Array<{ start: string; end: string }>>; firstName?: string; lastName?: string } } }
      if (!teacherResult.entity) {
        throw new Error(`Teacher not found: ${args.teacherId}`)
      }

      const availability = teacherResult.entity.data.availability || {}
      const requestedDate = new Date(args.date)
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][requestedDate.getDay()]
      const daySlots = availability[dayOfWeek] || []

      if (daySlots.length === 0) {
        return {
          teacherId: args.teacherId,
          teacherName: `${teacherResult.entity.data.firstName} ${teacherResult.entity.data.lastName}`,
          date: args.date,
          availableSlots: [],
          message: `Teacher is not available on ${dayOfWeek}s`
        }
      }

      const startOfDay = new Date(args.date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(args.date)
      endOfDay.setHours(23, 59, 59, 999)

      const existingSessions = await callBuiltinTool(ctx, 'entity.query', {
        type: 'session',
        filters: {
          idx_date_0_gte: startOfDay.toISOString(),
          idx_date_0_lte: endOfDay.toISOString()
        }
      }) as { entities?: Array<{ id: string; data: { scheduledAt: string; durationMinutes: number } }> }

      const bookedSlots = (existingSessions.entities || []).map(s => ({
        start: new Date(s.data.scheduledAt),
        end: new Date(new Date(s.data.scheduledAt).getTime() + s.data.durationMinutes * 60 * 1000)
      }))

      const availableSlots: Array<{ start: string; end: string }> = []

      for (const slot of daySlots) {
        const [startHour, startMin] = slot.start.split(':').map(Number)
        const [endHour, endMin] = slot.end.split(':').map(Number)

        const slotStart = new Date(args.date)
        slotStart.setHours(startHour, startMin, 0, 0)

        const slotEnd = new Date(args.date)
        slotEnd.setHours(endHour, endMin, 0, 0)

        let currentTime = slotStart
        while (currentTime.getTime() + duration * 60 * 1000 <= slotEnd.getTime()) {
          const potentialEnd = new Date(currentTime.getTime() + duration * 60 * 1000)

          const isConflict = bookedSlots.some(booked => {
            return currentTime < booked.end && potentialEnd > booked.start
          })

          if (!isConflict) {
            availableSlots.push({
              start: currentTime.toISOString(),
              end: potentialEnd.toISOString()
            })
          }

          currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000)
        }
      }

      return {
        teacherId: args.teacherId,
        teacherName: `${teacherResult.entity.data.firstName} ${teacherResult.entity.data.lastName}`,
        date: args.date,
        durationMinutes: duration,
        availableSlots
      }
    }
  },

  {
    name: 'cancel_session',
    description: 'Cancel a scheduled or confirmed session. Updates status, cancels scheduled jobs, and emits cancellation event.',
    parameters: {
      sessionId: {
        type: 'string',
        description: 'ID of the session entity',
        required: true
      },
      reason: {
        type: 'string',
        description: 'Reason for cancellation',
        required: true
      }
    },
    handler: async (params: Record<string, unknown>, ctx: ToolContext) => {
      const args = params as CancelSessionParams

      const sessionResult = await callBuiltinTool(ctx, 'entity.get', { id: args.sessionId, includeRelations: true }) as { entity?: { id: string; status: string; data: Record<string, unknown> }; relations?: Array<{ relationType: string; toEntityId: string }> }
      if (!sessionResult.entity) {
        throw new Error(`Session not found: ${args.sessionId}`)
      }

      const currentStatus = sessionResult.entity.status
      if (!['scheduled', 'confirmed'].includes(currentStatus)) {
        throw new Error(`Cannot cancel session with status: ${currentStatus}`)
      }

      await callBuiltinTool(ctx, 'entity.update', {
        id: args.sessionId,
        status: 'cancelled'
      })

      await callBuiltinTool(ctx, 'event.emit', {
        entityId: args.sessionId,
        eventType: 'session.cancelled',
        payload: {
          reason: args.reason,
          previousStatus: currentStatus
        }
      })

      return {
        success: true,
        sessionId: args.sessionId,
        previousStatus: currentStatus,
        newStatus: 'cancelled',
        reason: args.reason
      }
    }
  },

  {
    name: 'complete_session',
    description: 'Mark a session as completed with optional feedback. Triggers entitlement decrement and follow-up message.',
    parameters: {
      sessionId: {
        type: 'string',
        description: 'ID of the session entity',
        required: true
      },
      feedback: {
        type: 'object',
        description: 'Teacher feedback (optional)',
        required: false
      },
      notes: {
        type: 'string',
        description: 'Additional completion notes (optional)',
        required: false
      }
    },
    handler: async (params: Record<string, unknown>, ctx: ToolContext) => {
      const args = params as CompleteSessionParams

      const sessionResult = await callBuiltinTool(ctx, 'entity.get', { id: args.sessionId, includeRelations: true }) as { entity?: { id: string; status: string; data: Record<string, unknown> }; relations?: Array<{ relationType: string; toEntityId: string }> }
      if (!sessionResult.entity) {
        throw new Error(`Session not found: ${args.sessionId}`)
      }

      if (sessionResult.entity.status !== 'confirmed') {
        throw new Error(`Can only complete confirmed sessions, current status: ${sessionResult.entity.status}`)
      }

      const updateData: Record<string, unknown> = {}
      if (args.feedback) {
        updateData.feedback = args.feedback
      }
      if (args.notes) {
        updateData.notes = args.notes
      }

      await callBuiltinTool(ctx, 'entity.update', {
        id: args.sessionId,
        data: Object.keys(updateData).length > 0 ? updateData : undefined,
        status: 'completed'
      })

      const studentRelation = sessionResult.relations?.find(r => r.relationType === 'scheduled_for')
      const studentId = studentRelation?.toEntityId

      if (studentId) {
        await callBuiltinTool(ctx, 'job.enqueue', {
          jobType: 'decrement_entitlement',
          payload: {
            sessionId: args.sessionId,
            studentId
          },
          entityId: args.sessionId,
          idempotencyKey: `decrement:${args.sessionId}`
        })

        const studentResult = await callBuiltinTool(ctx, 'entity.get', { id: studentId, includeRelations: true }) as { entity?: { id: string }; reverseRelations?: Array<{ relationType: string; fromEntityId: string }> }
        const guardianRelation = studentResult.reverseRelations?.find((r: { relationType: string }) => r.relationType === 'guardian_of')

        if (guardianRelation) {
          await callBuiltinTool(ctx, 'job.enqueue', {
            jobType: 'send_followup',
            payload: {
              sessionId: args.sessionId,
              guardianId: guardianRelation.fromEntityId
            },
            entityId: args.sessionId,
            scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            idempotencyKey: `followup:${args.sessionId}`
          })
        }
      }

      await callBuiltinTool(ctx, 'event.emit', {
        entityId: args.sessionId,
        eventType: 'session.completed',
        payload: {
          feedback: args.feedback,
          studentId
        }
      })

      return {
        success: true,
        sessionId: args.sessionId,
        status: 'completed',
        entitlementDecrementScheduled: !!studentId,
        followupScheduled: !!studentId
      }
    }
  },

  {
    name: 'check_entitlement',
    description: 'Check remaining sessions in active entitlements for a student.',
    parameters: {
      studentId: {
        type: 'string',
        description: 'ID of the student entity',
        required: true
      }
    },
    handler: async (params: Record<string, unknown>, ctx: ToolContext) => {
      const args = params as CheckEntitlementParams

      const studentResult = await callBuiltinTool(ctx, 'entity.get', { id: args.studentId, includeRelations: true }) as { entity?: { id: string; data: { firstName?: string; lastName?: string } }; reverseRelations?: Array<{ relationType: string; fromEntityId: string }> }
      if (!studentResult.entity) {
        throw new Error(`Student not found: ${args.studentId}`)
      }

      const entitlementRelations = studentResult.reverseRelations?.filter((r: { relationType: string }) => r.relationType === 'entitles') || []
      const entitlements: Array<{
        id: string
        type: string
        sessionsRemaining: number
        sessionsTotal: number
        expiresAt: string
        status: string
        daysUntilExpiry: number
        isLowSessions: boolean
        isExpiringSoon: boolean
      }> = []

      for (const rel of entitlementRelations) {
        const entResult = await callBuiltinTool(ctx, 'entity.get', { id: rel.fromEntityId }) as { entity?: { id: string; status: string; data: { type: string; sessionsRemaining: number; sessionsTotal: number; expiresAt: string } } }
        if (entResult.entity && entResult.entity.status === 'active') {
          const expiresAt = new Date(entResult.entity.data.expiresAt)
          const now = new Date()
          const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

          entitlements.push({
            id: entResult.entity.id,
            type: entResult.entity.data.type,
            sessionsRemaining: entResult.entity.data.sessionsRemaining,
            sessionsTotal: entResult.entity.data.sessionsTotal,
            expiresAt: entResult.entity.data.expiresAt,
            status: entResult.entity.status,
            daysUntilExpiry,
            isLowSessions: entResult.entity.data.sessionsRemaining <= 2,
            isExpiringSoon: daysUntilExpiry <= 7
          })
        }
      }

      const totalRemaining = entitlements.reduce((sum, e) => sum + e.sessionsRemaining, 0)
      const hasLowSessions = entitlements.some(e => e.isLowSessions)
      const hasExpiringSoon = entitlements.some(e => e.isExpiringSoon)

      return {
        studentId: args.studentId,
        studentName: `${studentResult.entity.data.firstName} ${studentResult.entity.data.lastName}`,
        entitlements,
        summary: {
          totalActiveEntitlements: entitlements.length,
          totalSessionsRemaining: totalRemaining,
          hasLowSessions,
          hasExpiringSoon,
          warnings: [
            ...(hasLowSessions ? ['Low sessions remaining (2 or fewer)'] : []),
            ...(hasExpiringSoon ? ['Entitlement expiring within 7 days'] : []),
            ...(totalRemaining === 0 ? ['No sessions remaining - purchase required'] : [])
          ]
        }
      }
    }
  },

  {
    name: 'create_payment_link',
    description: 'Generate a payment link for a session or session pack.',
    parameters: {
      guardianId: {
        type: 'string',
        description: 'ID of the guardian making the payment',
        required: true
      },
      amount: {
        type: 'number',
        description: 'Payment amount',
        required: true
      },
      description: {
        type: 'string',
        description: 'Payment description',
        required: true
      },
      sessionId: {
        type: 'string',
        description: 'ID of the session being paid for (optional)',
        required: false
      },
      packType: {
        type: 'string',
        description: 'Type of session pack being purchased (optional)',
        required: false
      }
    },
    handler: async (params: Record<string, unknown>, ctx: ToolContext) => {
      const args = params as CreatePaymentLinkParams

      const guardianResult = await callBuiltinTool(ctx, 'entity.get', { id: args.guardianId }) as { entity?: { id: string; data: { firstName?: string; lastName?: string; email?: string } } }
      if (!guardianResult.entity) {
        throw new Error(`Guardian not found: ${args.guardianId}`)
      }

      if (args.sessionId) {
        const sessionResult = await callBuiltinTool(ctx, 'entity.get', { id: args.sessionId }) as { entity?: { id: string } }
        if (!sessionResult.entity) {
          throw new Error(`Session not found: ${args.sessionId}`)
        }
      }

      const paymentResult = await callBuiltinTool(ctx, 'entity.create', {
        type: 'payment',
        data: {
          amount: args.amount,
          currency: 'USD',
          method: 'credit_card',
          description: args.description,
          metadata: {
            guardianId: args.guardianId,
            sessionId: args.sessionId,
            packType: args.packType
          }
        },
        status: 'pending'
      }) as { entity: { id: string } }

      const paymentId = paymentResult.entity.id

      await callBuiltinTool(ctx, 'entity.link', {
        fromId: paymentId,
        toId: args.guardianId,
        relationType: 'paid_by'
      })

      if (args.sessionId) {
        await callBuiltinTool(ctx, 'entity.link', {
          fromId: paymentId,
          toId: args.sessionId,
          relationType: 'payment_for'
        })
      }

      const paymentLink = `https://pay.example.com/${paymentId}`

      return {
        success: true,
        paymentId,
        amount: args.amount,
        currency: 'USD',
        description: args.description,
        paymentLink,
        guardianEmail: guardianResult.entity.data.email,
        expiresIn: '24 hours'
      }
    }
  },

  {
    name: 'process_payment',
    description: 'Process a payment after receiving webhook confirmation. Updates payment status and triggers appropriate follow-up actions.',
    parameters: {
      paymentId: {
        type: 'string',
        description: 'ID of the payment entity',
        required: true
      },
      externalId: {
        type: 'string',
        description: 'External payment processor transaction ID',
        required: true
      },
      status: {
        type: 'string',
        description: 'Payment status from processor',
        required: true
      }
    },
    handler: async (params: Record<string, unknown>, ctx: ToolContext) => {
      const args = params as ProcessPaymentParams

      const paymentResult = await callBuiltinTool(ctx, 'entity.get', { id: args.paymentId, includeRelations: true }) as { entity?: { id: string; status: string; data: { metadata?: { sessionId?: string; packType?: string; guardianId?: string }; amount?: number } }; relations?: Array<{ relationType: string; toEntityId: string }> }
      if (!paymentResult.entity) {
        throw new Error(`Payment not found: ${args.paymentId}`)
      }

      if (paymentResult.entity.status !== 'pending') {
        throw new Error(`Payment already processed: ${paymentResult.entity.status}`)
      }

      await callBuiltinTool(ctx, 'entity.update', {
        id: args.paymentId,
        data: {
          externalId: args.externalId,
          paidAt: args.status === 'completed' ? new Date().toISOString() : null
        },
        status: args.status
      })

      let result: Record<string, unknown> = {
        success: true,
        paymentId: args.paymentId,
        status: args.status
      }

      if (args.status === 'completed') {
        const metadata = paymentResult.entity.data.metadata || {}

        if (metadata.sessionId) {
          await callBuiltinTool(ctx, 'entity.update', {
            id: metadata.sessionId,
            status: 'confirmed'
          })

          await callBuiltinTool(ctx, 'event.emit', {
            entityId: metadata.sessionId,
            eventType: 'session.confirmed',
            payload: { paymentId: args.paymentId }
          })

          result.sessionConfirmed = metadata.sessionId
        }

        if (metadata.packType && metadata.guardianId) {
          const packSizes: Record<string, number> = {
            'single_session': 1,
            'pack_5': 5,
            'pack_10': 10,
            'pack_20': 20,
            'monthly_unlimited': 999
          }

          const sessionsTotal = packSizes[metadata.packType] || 1
          const expiresAt = new Date()
          expiresAt.setMonth(expiresAt.getMonth() + (metadata.packType === 'monthly_unlimited' ? 1 : 6))

          const guardianResult = await callBuiltinTool(ctx, 'entity.get', { id: metadata.guardianId, includeRelations: true }) as { entity?: { id: string }; relations?: Array<{ relationType: string; toEntityId: string }> }
          const studentRelation = guardianResult.relations?.find((r: { relationType: string }) => r.relationType === 'guardian_of')

          if (studentRelation) {
            const entitlementResult = await callBuiltinTool(ctx, 'entity.create', {
              type: 'entitlement',
              data: {
                type: metadata.packType,
                sessionsRemaining: sessionsTotal,
                sessionsTotal,
                expiresAt: expiresAt.toISOString(),
                purchasedAt: new Date().toISOString()
              },
              status: 'active'
            }) as { entity: { id: string } }

            await callBuiltinTool(ctx, 'entity.link', {
              fromId: entitlementResult.entity.id,
              toId: studentRelation.toEntityId,
              relationType: 'entitles'
            })

            await callBuiltinTool(ctx, 'entity.link', {
              fromId: entitlementResult.entity.id,
              toId: metadata.guardianId,
              relationType: 'purchased_by'
            })

            await callBuiltinTool(ctx, 'entity.link', {
              fromId: args.paymentId,
              toId: entitlementResult.entity.id,
              relationType: 'purchases'
            })

            await callBuiltinTool(ctx, 'job.enqueue', {
              jobType: 'check_entitlement_expiry',
              payload: { entitlementId: entitlementResult.entity.id },
              entityId: entitlementResult.entity.id,
              scheduledFor: expiresAt.toISOString(),
              idempotencyKey: `expiry_check:${entitlementResult.entity.id}`
            })

            result.entitlementCreated = {
              id: entitlementResult.entity.id,
              type: metadata.packType,
              sessions: sessionsTotal,
              expiresAt: expiresAt.toISOString()
            }
          }
        }

        await callBuiltinTool(ctx, 'event.emit', {
          entityId: args.paymentId,
          eventType: 'payment.succeeded',
          payload: {
            amount: paymentResult.entity.data.amount,
            externalId: args.externalId
          }
        })
      } else {
        await callBuiltinTool(ctx, 'event.emit', {
          entityId: args.paymentId,
          eventType: 'payment.failed',
          payload: { reason: 'Payment declined' }
        })
      }

      return result
    }
  }
])
