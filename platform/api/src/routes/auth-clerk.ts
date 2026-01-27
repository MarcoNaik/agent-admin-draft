import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { Webhook } from 'svix'
import { generateId } from '@struere/platform-shared'
import { createDb, users, organizations } from '../db'
import { clerkAuth } from '../middleware/clerk'
import type { Env, AuthContext } from '../types'

export const authClerkRoutes = new Hono<{
  Bindings: Env
  Variables: { auth: AuthContext }
}>()

authClerkRoutes.get('/me', clerkAuth, async (c) => {
  const auth = c.get('auth')
  const db = createDb(c.env.DB)

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1)

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, auth.organizationId))
    .limit(1)

  return c.json({ user, organization: org })
})

authClerkRoutes.post('/webhooks/clerk', async (c) => {
  const webhookSecret = c.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    return c.json({ error: 'Webhook secret not configured' }, 500)
  }

  const svixId = c.req.header('svix-id')!
  const svixTimestamp = c.req.header('svix-timestamp')!
  const svixSignature = c.req.header('svix-signature')!

  const body = await c.req.text()

  const wh = new Webhook(webhookSecret)
  let event: ClerkWebhookEvent

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    }) as ClerkWebhookEvent
  } catch {
    return c.json({ error: 'Invalid webhook signature' }, 400)
  }

  const db = createDb(c.env.DB)

  switch (event.type) {
    case 'user.created': {
      const { id, email_addresses, first_name, last_name } = event.data
      const email = email_addresses[0]?.email_address
      const name = [first_name, last_name].filter(Boolean).join(' ') || email?.split('@')[0] || 'User'

      const now = new Date()
      const orgId = generateId('org')
      const userId = generateId('usr')

      await db.insert(organizations).values({
        id: orgId,
        name: `${name}'s Organization`,
        slug: generateSlug(name),
        plan: 'free',
        createdAt: now,
        updatedAt: now
      })

      await db.insert(users).values({
        id: userId,
        clerkId: id,
        email: email || '',
        name,
        organizationId: orgId,
        role: 'owner',
        createdAt: now,
        updatedAt: now
      })

      break
    }

    case 'user.updated': {
      const { id, email_addresses, first_name, last_name } = event.data
      const email = email_addresses[0]?.email_address
      const name = [first_name, last_name].filter(Boolean).join(' ')

      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (email) updates.email = email
      if (name) updates.name = name

      await db
        .update(users)
        .set(updates)
        .where(eq(users.clerkId, id))

      break
    }

    case 'user.deleted': {
      const { id } = event.data

      await db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.clerkId, id))

      break
    }

    case 'organization.created': {
      const { id, name, slug } = event.data
      const now = new Date()

      await db.insert(organizations).values({
        id: generateId('org'),
        clerkId: id,
        name,
        slug: slug || generateSlug(name),
        plan: 'free',
        createdAt: now,
        updatedAt: now
      })

      break
    }

    case 'organization.updated': {
      const { id, name, slug } = event.data

      await db
        .update(organizations)
        .set({ name, slug, updatedAt: new Date() })
        .where(eq(organizations.clerkId, id))

      break
    }

    case 'organizationMembership.created': {
      const { organization, public_user_data, role } = event.data

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkId, organization.id))
        .limit(1)

      if (org) {
        await db
          .update(users)
          .set({
            organizationId: org.id,
            role: role === 'admin' ? 'admin' : 'member',
            updatedAt: new Date()
          })
          .where(eq(users.clerkId, public_user_data.user_id))
      }

      break
    }
  }

  return c.json({ received: true })
})

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses?: Array<{ email_address: string }>
    first_name?: string
    last_name?: string
    name?: string
    slug?: string
    organization?: { id: string }
    public_user_data?: { user_id: string }
    role?: string
  }
}
