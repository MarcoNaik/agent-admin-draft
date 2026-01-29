import { Hono } from 'hono'
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import { createDb, executions, agents } from '../db'
import type { MiddlewareHandler } from 'hono'
import type { AuthContext, RouteEnv } from './agents'

export function createUsageRoutes<E extends RouteEnv>(authMiddleware: MiddlewareHandler) {
  const usageRoutes = new Hono<{
    Bindings: E
    Variables: { auth: AuthContext }
  }>()

  usageRoutes.use('*', authMiddleware)

  usageRoutes.get('/', async (c) => {
    const auth = c.get('auth')
    const db = createDb(c.env.DB)

    const period = c.req.query('period') || 'day'
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    const result = await db
      .select({
        totalExecutions: sql<number>`count(*)`,
        totalInputTokens: sql<number>`sum(${executions.inputTokens})`,
        totalOutputTokens: sql<number>`sum(${executions.outputTokens})`,
        totalDurationMs: sql<number>`sum(${executions.durationMs})`,
        successCount: sql<number>`sum(case when ${executions.status} = 'success' then 1 else 0 end)`,
        errorCount: sql<number>`sum(case when ${executions.status} = 'error' then 1 else 0 end)`
      })
      .from(executions)
      .where(and(
        eq(executions.organizationId, auth.organizationId),
        gte(executions.timestamp, startDate),
        lte(executions.timestamp, now)
      ))

    const summary = result[0] || {
      totalExecutions: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalDurationMs: 0,
      successCount: 0,
      errorCount: 0
    }

    return c.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      summary: {
        executions: summary.totalExecutions || 0,
        inputTokens: summary.totalInputTokens || 0,
        outputTokens: summary.totalOutputTokens || 0,
        totalTokens: (summary.totalInputTokens || 0) + (summary.totalOutputTokens || 0),
        avgDurationMs: summary.totalExecutions
          ? Math.round((summary.totalDurationMs || 0) / summary.totalExecutions)
          : 0,
        successRate: summary.totalExecutions
          ? Math.round(((summary.successCount || 0) / summary.totalExecutions) * 100)
          : 100
      }
    })
  })

  usageRoutes.get('/by-agent', async (c) => {
    const auth = c.get('auth')
    const db = createDb(c.env.DB)

    const period = c.req.query('period') || 'day'
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    const result = await db
      .select({
        agentId: executions.agentId,
        agentName: agents.name,
        agentSlug: agents.slug,
        executions: sql<number>`count(*)`,
        inputTokens: sql<number>`sum(${executions.inputTokens})`,
        outputTokens: sql<number>`sum(${executions.outputTokens})`,
        avgDurationMs: sql<number>`avg(${executions.durationMs})`
      })
      .from(executions)
      .innerJoin(agents, eq(executions.agentId, agents.id))
      .where(and(
        eq(executions.organizationId, auth.organizationId),
        gte(executions.timestamp, startDate),
        lte(executions.timestamp, now)
      ))
      .groupBy(executions.agentId, agents.name, agents.slug)
      .orderBy(desc(sql`count(*)`))

    return c.json({ period, agents: result })
  })

  usageRoutes.get('/recent', async (c) => {
    const auth = c.get('auth')
    const db = createDb(c.env.DB)
    const limit = parseInt(c.req.query('limit') || '50')

    const result = await db
      .select({
        id: executions.id,
        agentId: executions.agentId,
        agentName: agents.name,
        conversationId: executions.conversationId,
        inputTokens: executions.inputTokens,
        outputTokens: executions.outputTokens,
        durationMs: executions.durationMs,
        status: executions.status,
        errorMessage: executions.errorMessage,
        timestamp: executions.timestamp
      })
      .from(executions)
      .innerJoin(agents, eq(executions.agentId, agents.id))
      .where(eq(executions.organizationId, auth.organizationId))
      .orderBy(desc(executions.timestamp))
      .limit(Math.min(limit, 100))

    return c.json({ executions: result })
  })

  return usageRoutes
}
