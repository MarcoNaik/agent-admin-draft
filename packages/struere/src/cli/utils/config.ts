import { join } from 'path'
import type { FrameworkConfig } from '../../types'

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
  const configPath = join(cwd, 'struere.config.ts')

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
