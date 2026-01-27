import { syncMessageSchema, generateId } from '@struere/platform-shared'
import type { SyncResponse } from '@struere/platform-shared'
import * as jose from 'jose'

interface SessionState {
  organizationId: string | null
  agentId: string | null
  agentSlug: string | null
  userId: string | null
  bundleCode: string | null
  configHash: string | null
  previewUrl: string | null
}

export class DevSessionDO implements DurableObject {
  private state: DurableObjectState
  private env: Record<string, unknown>
  private sessions: Map<WebSocket, SessionState> = new Map()

  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.state.acceptWebSocket(server)

    this.sessions.set(server, {
      organizationId: null,
      agentId: null,
      agentSlug: null,
      userId: null,
      bundleCode: null,
      configHash: null,
      previewUrl: null
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return

    try {
      const data = JSON.parse(message)
      const parsed = syncMessageSchema.safeParse(data)

      if (!parsed.success) {
        this.send(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Invalid message format' })
        return
      }

      const session = this.sessions.get(ws)
      if (!session) return

      switch (parsed.data.type) {
        case 'auth':
          await this.handleAuth(ws, session, parsed.data.apiKey)
          break
        case 'sync':
          await this.handleSync(ws, session, parsed.data)
          break
        case 'ping':
          this.send(ws, { type: 'pong' })
          break
        case 'unsync':
          await this.handleUnsync(ws, session)
          break
      }
    } catch (error) {
      this.send(ws, {
        type: 'error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const session = this.sessions.get(ws)
    if (session?.organizationId && session?.agentSlug) {
      const stateKv = this.env.STATE as KVNamespace
      const sessionId = `${session.organizationId}:${session.agentSlug}`
      await stateKv.delete(`dev:${sessionId}`)
    }
    this.sessions.delete(ws)
  }

  private async handleAuth(ws: WebSocket, session: SessionState, token: string): Promise<void> {
    const db = this.env.DB as D1Database

    if (token.includes('.')) {
      const jwtResult = await this.verifyJwt(token)
      if (jwtResult) {
        session.organizationId = jwtResult.org
        session.userId = jwtResult.sub
        this.send(ws, { type: 'authenticated', organizationId: jwtResult.org })
        return
      }
    }

    const keyHash = await this.hashKey(token)
    const result = await db.prepare(`
      SELECT ak.organization_id, ak.permissions, u.id as user_id
      FROM api_keys ak
      LEFT JOIN users u ON u.organization_id = ak.organization_id
      WHERE ak.key_hash = ?
    `).bind(keyHash).first<{
      organization_id: string
      permissions: string
      user_id: string
    }>()

    if (!result) {
      this.send(ws, { type: 'error', code: 'INVALID_API_KEY', message: 'Invalid API key or token' })
      return
    }

    const permissions = JSON.parse(result.permissions) as string[]
    if (!permissions.includes('agent:write')) {
      this.send(ws, { type: 'error', code: 'INSUFFICIENT_PERMISSIONS', message: 'API key needs agent:write permission' })
      return
    }

    session.organizationId = result.organization_id
    session.userId = result.user_id

    this.send(ws, { type: 'authenticated', organizationId: result.organization_id })
  }

  private async verifyJwt(token: string): Promise<{ sub: string; org: string } | null> {
    try {
      const jwtSecret = this.env.JWT_SECRET as string
      if (!jwtSecret) return null

      const secret = new TextEncoder().encode(jwtSecret)
      const { payload } = await jose.jwtVerify(token, secret)

      if (payload.type !== 'cli') return null

      return { sub: payload.sub as string, org: payload.org as string }
    } catch {
      return null
    }
  }

  private async handleSync(
    ws: WebSocket,
    session: SessionState,
    data: { agentSlug: string; bundle: string; configHash: string }
  ): Promise<void> {
    if (!session.organizationId) {
      this.send(ws, { type: 'error', code: 'NOT_AUTHENTICATED', message: 'Must authenticate first' })
      return
    }

    const db = this.env.DB as D1Database
    const stateKv = this.env.STATE as KVNamespace

    let agent = await db.prepare(`
      SELECT id, slug FROM agents
      WHERE organization_id = ? AND slug = ? AND status = 'active'
    `).bind(session.organizationId, data.agentSlug).first<{ id: string; slug: string }>()

    if (!agent) {
      const agentId = generateId('agt')
      const now = Math.floor(Date.now() / 1000)
      await db.prepare(`
        INSERT INTO agents (id, organization_id, name, slug, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
      `).bind(agentId, session.organizationId, data.agentSlug, data.agentSlug, now, now).run()
      agent = { id: agentId, slug: data.agentSlug }
    }

    session.agentId = agent.id
    session.agentSlug = agent.slug
    session.bundleCode = data.bundle
    session.configHash = data.configHash

    const sessionId = `${session.organizationId}:${data.agentSlug}`
    const baseUrl = (this.env.ENVIRONMENT as string) === 'production'
      ? 'struere.dev'
      : 'dev.struere.dev'

    session.previewUrl = `https://${data.agentSlug}-dev.${baseUrl}`

    await stateKv.put(`dev:${sessionId}`, JSON.stringify({
      organizationId: session.organizationId,
      agentId: session.agentId,
      bundleCode: session.bundleCode
    }), { expirationTtl: 60 * 60 })

    this.send(ws, {
      type: 'synced',
      agentId: agent.id,
      url: session.previewUrl
    })

    this.send(ws, {
      type: 'log',
      level: 'info',
      message: `Agent synced successfully`,
      timestamp: new Date().toISOString()
    })
  }

  private async handleUnsync(ws: WebSocket, session: SessionState): Promise<void> {
    if (session.organizationId && session.agentSlug) {
      const stateKv = this.env.STATE as KVNamespace
      const sessionId = `${session.organizationId}:${session.agentSlug}`
      await stateKv.delete(`dev:${sessionId}`)
    }

    session.agentId = null
    session.agentSlug = null
    session.bundleCode = null
    session.configHash = null
    session.previewUrl = null

    this.send(ws, { type: 'unsynced' })
  }

  private send(ws: WebSocket, message: SyncResponse): void {
    ws.send(JSON.stringify(message))
  }

  private async hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(key)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}
