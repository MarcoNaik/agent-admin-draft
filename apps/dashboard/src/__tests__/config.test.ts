import { describe, test, expect } from 'bun:test'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const rootDir = join(__dirname, '../../../../')
const dashboardDir = join(__dirname, '../../')

describe('environment configuration', () => {
  const requiredClerkEnvVars = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
  ]

  describe('turbo.json globalEnv', () => {
    test('contains all required Clerk environment variables', () => {
      const turboConfigPath = join(rootDir, 'turbo.json')
      expect(existsSync(turboConfigPath)).toBe(true)

      const turboConfig = JSON.parse(readFileSync(turboConfigPath, 'utf-8'))
      expect(turboConfig.globalEnv).toBeDefined()

      for (const envVar of requiredClerkEnvVars) {
        expect(turboConfig.globalEnv).toContain(envVar)
      }
    })

    test('dev task has cache disabled for development', () => {
      const turboConfigPath = join(rootDir, 'turbo.json')
      const turboConfig = JSON.parse(readFileSync(turboConfigPath, 'utf-8'))

      expect(turboConfig.tasks.dev.cache).toBe(false)
      expect(turboConfig.tasks.dev.persistent).toBe(true)
    })
  })

  describe('.env.example', () => {
    test('documents all required Clerk environment variables', () => {
      const envExamplePath = join(dashboardDir, '.env.example')
      expect(existsSync(envExamplePath)).toBe(true)

      const envExample = readFileSync(envExamplePath, 'utf-8')

      for (const envVar of requiredClerkEnvVars) {
        expect(envExample).toContain(envVar)
      }
    })

    test('contains placeholder values for secrets', () => {
      const envExamplePath = join(dashboardDir, '.env.example')
      const envExample = readFileSync(envExamplePath, 'utf-8')

      expect(envExample).toContain('pk_test_...')
      expect(envExample).toContain('sk_test_...')
    })
  })

  describe('ClerkProvider configuration', () => {
    test('layout.tsx imports ClerkProvider from @clerk/nextjs', () => {
      const layoutPath = join(dashboardDir, 'src/app/layout.tsx')
      expect(existsSync(layoutPath)).toBe(true)

      const layoutContent = readFileSync(layoutPath, 'utf-8')
      expect(layoutContent).toContain('import { ClerkProvider } from "@clerk/nextjs"')
      expect(layoutContent).toContain('<ClerkProvider>')
    })

    test('middleware.ts uses clerkMiddleware', () => {
      const middlewarePath = join(dashboardDir, 'src/middleware.ts')
      expect(existsSync(middlewarePath)).toBe(true)

      const middlewareContent = readFileSync(middlewarePath, 'utf-8')
      expect(middlewareContent).toContain('clerkMiddleware')
      expect(middlewareContent).toContain('@clerk/nextjs/server')
    })
  })
})
