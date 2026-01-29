import { defineAgent } from '@struere/core'
import { tutoringTools } from './tools'
import * as fs from 'fs'
import * as path from 'path'

const systemPromptPath = path.join(__dirname, 'system-prompt.md')
const systemPrompt = fs.existsSync(systemPromptPath)
  ? fs.readFileSync(systemPromptPath, 'utf-8')
  : `You are a tutoring operations assistant. Help manage students, teachers, sessions, payments, and entitlements.`

export default defineAgent({
  name: 'Tutoring Assistant',
  version: '1.0.0',
  systemPrompt,
  model: {
    provider: 'anthropic',
    name: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 4096
  },
  tools: tutoringTools,
  state: {
    backend: 'memory',
    conversationTTL: 3600
  }
})
