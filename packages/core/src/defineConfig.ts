import type { FrameworkConfig } from './types'

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

export function defineConfig(config: Partial<FrameworkConfig> = {}): FrameworkConfig {
  return {
    ...defaultConfig,
    ...config,
    cors: config.cors
      ? { ...defaultConfig.cors, ...config.cors }
      : defaultConfig.cors,
    logging: config.logging
      ? { ...defaultConfig.logging, ...config.logging }
      : defaultConfig.logging,
    auth: config.auth
      ? { ...defaultConfig.auth, ...config.auth }
      : defaultConfig.auth,
  } as FrameworkConfig
}
