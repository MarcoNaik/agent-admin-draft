import { join } from 'path'
import type { FrameworkConfig } from '@marco-kueks/agent-factory-core'

const defaultConfig: FrameworkConfig = {
  port: 3000,
  host: 'localhost',
  cors: {
    origins: ['http://localhost:3000'],
    credentials: true,
  },
  logging: {
    level: 'info',
    format: 'pretty',
  },
  auth: {
    type: 'none',
  },
}

export async function loadConfig(cwd: string): Promise<FrameworkConfig> {
  const configPath = join(cwd, 'af.config.ts')

  try {
    const module = await import(configPath)
    const config = module.default || module

    return {
      ...defaultConfig,
      ...config,
      cors: {
        ...defaultConfig.cors,
        ...config.cors,
      },
      logging: {
        ...defaultConfig.logging,
        ...config.logging,
      },
      auth: {
        ...defaultConfig.auth,
        ...config.auth,
      },
    }
  } catch {
    return defaultConfig
  }
}
