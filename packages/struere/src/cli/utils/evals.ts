import { loadCredentials, getApiKey } from './credentials'
import { CONVEX_URL } from './config'

type Environment = 'development' | 'production' | 'eval'

function getToken(): string {
  const credentials = loadCredentials()
  const apiKey = getApiKey()
  const token = apiKey || credentials?.token
  if (!token) throw new Error('Not authenticated')
  return token
}

async function convexQuery<T>(path: string, args: Record<string, unknown>): Promise<T> {
  const token = getToken()
  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ path, args }),
  })

  const text = await response.text()
  let json: { status?: string; value?: T; errorMessage?: string; errorData?: { message?: string } }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(text || `HTTP ${response.status}`)
  }

  if (!response.ok) {
    throw new Error(json.errorData?.message || json.errorMessage || text)
  }

  if (json.status === 'error') {
    throw new Error(json.errorMessage || 'Unknown error from Convex')
  }

  return json.value as T
}

async function convexMutation<T>(path: string, args: Record<string, unknown>): Promise<T> {
  const token = getToken()
  const response = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ path, args }),
  })

  const text = await response.text()
  let json: { status?: string; value?: T; errorMessage?: string; errorData?: { message?: string } }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(text || `HTTP ${response.status}`)
  }

  if (!response.ok) {
    throw new Error(json.errorData?.message || json.errorMessage || text)
  }

  if (json.status === 'error') {
    throw new Error(json.errorMessage || 'Unknown error from Convex')
  }

  return json.value as T
}

export interface EvalSuite {
  _id: string
  name: string
  slug: string
  agentId: string
  environment: Environment
  description?: string
  tags?: string[]
  status: string
}

export interface EvalCase {
  _id: string
  name: string
  description?: string
  tags?: string[]
  turns: Array<{
    userMessage: string
    assertions?: Array<{
      type: string
      criteria?: string
      value?: string
      weight?: number
    }>
  }>
  finalAssertions?: Array<{
    type: string
    criteria?: string
    value?: string
    weight?: number
  }>
  order: number
}

export interface EvalRun {
  _id: string
  suiteId: string
  agentId: string
  environment: Environment
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  totalCases: number
  completedCases: number
  passedCases: number
  failedCases: number
  overallScore?: number
  totalDurationMs?: number
  totalTokens?: { agent: number; judge: number }
  startedAt?: number
  completedAt?: number
}

export interface EvalResult {
  _id: string
  runId: string
  caseId: string
  caseName: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error'
  overallPassed: boolean
  overallScore?: number
  totalDurationMs?: number
  errorMessage?: string
  turnResults?: Array<{
    turnIndex: number
    userMessage: string
    assistantResponse: string
    toolCalls?: Array<{
      name: string
      arguments: unknown
      result?: unknown
    }>
    assertionResults?: Array<{
      type: string
      passed: boolean
      score?: number
      reason?: string
      criteria?: string
    }>
    durationMs: number
    agentTokens?: { input: number; output: number }
  }>
  finalAssertionResults?: Array<{
    type: string
    passed: boolean
    score?: number
    reason?: string
    criteria?: string
  }>
  judgeTokens?: { input: number; output: number }
}

export async function listAllSuites(environment: Environment, organizationId?: string): Promise<EvalSuite[]> {
  return convexQuery<EvalSuite[]>('evals:listAllSuites', { environment, organizationId })
}

export async function listCases(suiteId: string, organizationId?: string): Promise<EvalCase[]> {
  return convexQuery<EvalCase[]>('evals:listCases', { suiteId, organizationId })
}

export async function startRun(suiteId: string, caseIds?: string[], organizationId?: string): Promise<string> {
  return convexMutation<string>('evals:startRun', {
    suiteId,
    triggerSource: 'cli',
    organizationId,
    ...(caseIds ? { caseIds } : {}),
  })
}

export async function getRun(runId: string, organizationId?: string): Promise<EvalRun | null> {
  return convexQuery<EvalRun | null>('evals:getRun', { id: runId, organizationId })
}

export async function getRunResults(runId: string, organizationId?: string): Promise<EvalResult[]> {
  return convexQuery<EvalResult[]>('evals:getRunResults', { runId, organizationId })
}
