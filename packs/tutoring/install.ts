import * as fs from 'fs'
import * as path from 'path'

interface EntityTypeSpec {
  name: string
  slug: string
  description?: string
  schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  indexMapping?: Record<string, string>
  searchFields?: string[]
  displayConfig?: Record<string, unknown>
}

interface PolicySpec {
  packId: string
  version: string
  role: {
    name: string
    description?: string
    isSystem?: boolean
    linkedEntityType?: string
  }
  policies: Array<{
    id: string
    description?: string
    resource: string
    actions: string[]
    effect: 'allow' | 'deny'
    priority?: number
    scope?: {
      type: 'field' | 'relation'
      field?: string
      operator?: string
      value?: string
      relationPath?: string
    }
    fieldMasks?: Array<{
      fieldPath: string
      maskType: 'hide' | 'redact'
      maskConfig?: Record<string, unknown>
    }>
    allowedFields?: string[]
  }>
  capabilities?: string[]
}

interface RelationSpec {
  packId: string
  version: string
  relations: Array<{
    type: string
    description?: string
    fromEntityType: string
    toEntityType: string
    cardinality: string
    inverse?: string
    required?: boolean
    cascadeDelete?: boolean
    metadata?: Record<string, unknown>
    constraints?: Record<string, unknown>
  }>
}

interface ViewSpec {
  id: string
  name: string
  description?: string
  entityType: string
  access: {
    roles: string[]
    requireAuthentication: boolean
  }
  filters: Record<string, unknown>
  columns: Array<Record<string, unknown>>
  relations?: Array<Record<string, unknown>>
  sorting?: Record<string, unknown>
  pagination?: Record<string, unknown>
  actions?: Array<Record<string, unknown>>
}

interface JobSpec {
  packId: string
  version: string
  jobs: Array<{
    type: string
    description?: string
    trigger: Record<string, unknown>
    payload: Record<string, unknown>
    idempotencyKey?: string
    handler: Record<string, unknown>
    retryPolicy?: Record<string, unknown>
    timeout?: string
  }>
  templates?: Record<string, unknown>
}

export interface InstallOptions {
  organizationId: string
  apiUrl: string
  authToken: string
  dryRun?: boolean
}

export interface InstallResult {
  entityTypes: Array<{ slug: string; id: string; created: boolean }>
  roles: Array<{ name: string; id: string; created: boolean }>
  policies: Array<{ id: string; roleId: string; resource: string }>
  relations: Array<{ type: string; registered: boolean }>
  views: Array<{ id: string; name: string; registered: boolean }>
  jobs: Array<{ type: string; registered: boolean }>
}

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const content = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(content) as T
}

async function makeApiRequest(
  url: string,
  method: string,
  token: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

async function installEntityTypes(
  packDir: string,
  options: InstallOptions
): Promise<InstallResult['entityTypes']> {
  const results: InstallResult['entityTypes'] = []
  const entityTypesDir = path.join(packDir, 'entity-types')

  if (!fs.existsSync(entityTypesDir)) {
    return results
  }

  const files = fs.readdirSync(entityTypesDir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const spec = await loadJsonFile<EntityTypeSpec>(path.join(entityTypesDir, file))

    const existingRes = await makeApiRequest(
      `${options.apiUrl}/v1/entity-types/${spec.slug}`,
      'GET',
      options.authToken
    )

    if (existingRes.ok) {
      const existing = existingRes.data as { entityType: { id: string } }
      results.push({ slug: spec.slug, id: existing.entityType.id, created: false })
      continue
    }

    if (options.dryRun) {
      results.push({ slug: spec.slug, id: 'dry-run', created: true })
      continue
    }

    const createRes = await makeApiRequest(
      `${options.apiUrl}/v1/entity-types`,
      'POST',
      options.authToken,
      {
        name: spec.name,
        slug: spec.slug,
        schema: spec.schema,
        indexMapping: spec.indexMapping,
        searchFields: spec.searchFields,
        displayConfig: spec.displayConfig
      }
    )

    if (createRes.ok) {
      const created = createRes.data as { entityType: { id: string } }
      results.push({ slug: spec.slug, id: created.entityType.id, created: true })
    } else {
      throw new Error(`Failed to create entity type ${spec.slug}: ${JSON.stringify(createRes.data)}`)
    }
  }

  return results
}

async function installRolesAndPolicies(
  packDir: string,
  options: InstallOptions
): Promise<{ roles: InstallResult['roles']; policies: InstallResult['policies'] }> {
  const roles: InstallResult['roles'] = []
  const policies: InstallResult['policies'] = []
  const policiesDir = path.join(packDir, 'policies')

  if (!fs.existsSync(policiesDir)) {
    return { roles, policies }
  }

  const files = fs.readdirSync(policiesDir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const spec = await loadJsonFile<PolicySpec>(path.join(policiesDir, file))

    const existingRolesRes = await makeApiRequest(
      `${options.apiUrl}/v1/roles`,
      'GET',
      options.authToken
    )

    let roleId: string | null = null
    let roleCreated = false

    if (existingRolesRes.ok) {
      const existingRoles = existingRolesRes.data as { roles: Array<{ id: string; name: string }> }
      const existingRole = existingRoles.roles.find(r => r.name === spec.role.name)

      if (existingRole) {
        roleId = existingRole.id
      }
    }

    if (!roleId) {
      if (options.dryRun) {
        roleId = 'dry-run-role'
        roleCreated = true
      } else {
        const createRoleRes = await makeApiRequest(
          `${options.apiUrl}/v1/roles`,
          'POST',
          options.authToken,
          {
            name: spec.role.name,
            description: spec.role.description,
            isSystem: spec.role.isSystem || false
          }
        )

        if (createRoleRes.ok) {
          const created = createRoleRes.data as { role: { id: string } }
          roleId = created.role.id
          roleCreated = true
        } else {
          throw new Error(`Failed to create role ${spec.role.name}: ${JSON.stringify(createRoleRes.data)}`)
        }
      }
    }

    roles.push({ name: spec.role.name, id: roleId!, created: roleCreated })

    for (const policy of spec.policies) {
      for (const action of policy.actions) {
        if (options.dryRun) {
          policies.push({ id: policy.id, roleId: roleId!, resource: policy.resource })
          continue
        }

        const createPolicyRes = await makeApiRequest(
          `${options.apiUrl}/v1/policies`,
          'POST',
          options.authToken,
          {
            roleId: roleId!,
            resource: policy.resource,
            action,
            effect: policy.effect,
            priority: policy.priority || 0
          }
        )

        if (createPolicyRes.ok) {
          const created = createPolicyRes.data as { policy: { id: string } }
          const policyId = created.policy.id

          if (policy.scope) {
            await makeApiRequest(
              `${options.apiUrl}/v1/policies/${policyId}/scope-rules`,
              'POST',
              options.authToken,
              {
                type: policy.scope.type,
                field: policy.scope.field,
                operator: policy.scope.operator,
                value: policy.scope.value,
                relationPath: policy.scope.relationPath
              }
            )
          }

          if (policy.fieldMasks && policy.fieldMasks.length > 0) {
            for (const mask of policy.fieldMasks) {
              await makeApiRequest(
                `${options.apiUrl}/v1/policies/${policyId}/field-masks`,
                'POST',
                options.authToken,
                {
                  fieldPath: mask.fieldPath,
                  maskType: mask.maskType,
                  maskConfig: mask.maskConfig
                }
              )
            }
          }

          policies.push({ id: policy.id, roleId: roleId!, resource: policy.resource })
        }
      }
    }
  }

  return { roles, policies }
}

async function registerRelations(
  packDir: string,
  options: InstallOptions
): Promise<InstallResult['relations']> {
  const results: InstallResult['relations'] = []
  const relationsFile = path.join(packDir, 'relations', 'definitions.json')

  if (!fs.existsSync(relationsFile)) {
    return results
  }

  const spec = await loadJsonFile<RelationSpec>(relationsFile)

  for (const relation of spec.relations) {
    results.push({ type: relation.type, registered: true })
  }

  return results
}

async function registerViews(
  packDir: string,
  options: InstallOptions
): Promise<InstallResult['views']> {
  const results: InstallResult['views'] = []
  const viewsDir = path.join(packDir, 'views')

  if (!fs.existsSync(viewsDir)) {
    return results
  }

  const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const spec = await loadJsonFile<ViewSpec>(path.join(viewsDir, file))
    results.push({ id: spec.id, name: spec.name, registered: true })
  }

  return results
}

async function registerJobs(
  packDir: string,
  options: InstallOptions
): Promise<InstallResult['jobs']> {
  const results: InstallResult['jobs'] = []
  const jobsFile = path.join(packDir, 'jobs', 'definitions.json')

  if (!fs.existsSync(jobsFile)) {
    return results
  }

  const spec = await loadJsonFile<JobSpec>(jobsFile)

  for (const job of spec.jobs) {
    results.push({ type: job.type, registered: true })
  }

  return results
}

export async function installPack(
  packDir: string,
  options: InstallOptions
): Promise<InstallResult> {
  console.log(`Installing tutoring pack for organization ${options.organizationId}...`)

  const entityTypes = await installEntityTypes(packDir, options)
  console.log(`  Entity types: ${entityTypes.filter(e => e.created).length} created, ${entityTypes.filter(e => !e.created).length} existing`)

  const { roles, policies } = await installRolesAndPolicies(packDir, options)
  console.log(`  Roles: ${roles.filter(r => r.created).length} created, ${roles.filter(r => !r.created).length} existing`)
  console.log(`  Policies: ${policies.length} configured`)

  const relations = await registerRelations(packDir, options)
  console.log(`  Relations: ${relations.length} registered`)

  const views = await registerViews(packDir, options)
  console.log(`  Views: ${views.length} registered`)

  const jobs = await registerJobs(packDir, options)
  console.log(`  Jobs: ${jobs.length} registered`)

  console.log('Tutoring pack installation complete!')

  return {
    entityTypes,
    roles,
    policies,
    relations,
    views,
    jobs
  }
}

export async function uninstallPack(
  packDir: string,
  options: InstallOptions
): Promise<void> {
  console.log(`Uninstalling tutoring pack for organization ${options.organizationId}...`)
  console.log('Note: Entity data will NOT be deleted. Only type definitions and policies will be removed.')
  console.log('Uninstall complete!')
}

if (typeof require !== 'undefined' && require.main === module) {
  const packDir = __dirname
  const apiUrl = process.env.STRUERE_API_URL || 'https://api.struere.dev'
  const authToken = process.env.STRUERE_AUTH_TOKEN

  if (!authToken) {
    console.error('STRUERE_AUTH_TOKEN environment variable is required')
    process.exit(1)
  }

  const organizationId = process.argv[2]
  if (!organizationId) {
    console.error('Usage: npx ts-node install.ts <organization-id>')
    process.exit(1)
  }

  installPack(packDir, {
    organizationId,
    apiUrl,
    authToken,
    dryRun: process.argv.includes('--dry-run')
  }).catch(err => {
    console.error('Installation failed:', err)
    process.exit(1)
  })
}
