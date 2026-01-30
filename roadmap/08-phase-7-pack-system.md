# Phase 7: Pack System & Migrations

## Document Purpose

This document details the formalization of the pack system—reusable templates that package entity types, roles, policies, workflows, and starter configurations. By the end of this phase, packs are versioned, installable, and upgradeable.

**Status**: 📋 Planned

**Dependencies**: Phase 6 (Dashboard Role Modules)

**Estimated Scope**: Pack versioning (~200 lines), migration system (~400 lines), installation UI (~200 lines)

---

## Context: Why Packs Matter

### The Scaling Problem

Without packs, every new customer requires:
1. Manual entity type creation
2. Manual role and policy configuration
3. Manual field mask setup
4. Manual workflow definition

This is the "services company" trap—we become consultants, not a platform.

### The Pack Solution

Packs are reusable templates that capture:
- Entity type definitions
- Role and policy configurations
- Field mask definitions
- Scope rule definitions
- Workflow/job templates
- Starter agent configurations

With packs, onboarding becomes:
1. Install pack
2. Customize as needed
3. Go live

### The Tutoring Pack as Template

Phase 4 built the tutoring domain manually. Phase 7 packages it as a reusable pack that:
- Can be installed by other tutoring businesses
- Can be versioned and upgraded
- Serves as the template for future packs

---

## Goals

By the end of Phase 7:

1. **Pack versioning exists** - Packs have semantic versions
2. **Pack installation tracks version** - Know what version is installed
3. **Pack migrations work** - Upgrade installed packs to new versions
4. **Pack catalog exists** - List available packs
5. **Installation UI works** - Admins can install packs from dashboard
6. **Customization is preserved** - Upgrades don't overwrite customizations

---

## Non-Goals for This Phase

1. **Pack marketplace** - Public pack sharing (future)
2. **Custom pack creation UI** - Packs defined in code
3. **Pack dependencies** - One pack requiring another
4. **Rollback** - Downgrading pack versions

---

## Pack Definition Structure

### Current Structure (Phase 4)

```typescript
interface PackDefinition {
  id: string
  name: string
  version: string
  description: string
  entityTypes: EntityTypeDefinition[]
  roles: RoleDefinition[]
}
```

### Enhanced Structure (Phase 7)

```typescript
interface PackDefinition {
  id: string
  name: string
  version: string  // Semantic version: "1.0.0"
  description: string
  author: string
  license: string

  entityTypes: EntityTypeDefinition[]
  roles: RoleDefinition[]
  policies: PolicyDefinition[]
  scopeRules: ScopeRuleDefinition[]
  fieldMasks: FieldMaskDefinition[]
  jobTypes: JobTypeDefinition[]

  migrations: Migration[]

  hooks?: {
    postInstall?: string  // Function name to call after install
    preUpgrade?: string   // Function name to call before upgrade
    postUpgrade?: string  // Function name to call after upgrade
  }
}

interface Migration {
  fromVersion: string
  toVersion: string
  steps: MigrationStep[]
}

interface MigrationStep {
  type: "add_field" | "remove_field" | "rename_field" | "add_entity_type" | "modify_schema" | "run_script"
  entityType?: string
  field?: string
  newField?: string
  defaultValue?: unknown
  script?: string
}
```

### Example: Tutoring Pack v1.0.0

```typescript
export const tutoringPack: PackDefinition = {
  id: "tutoring",
  name: "Tutoring Operations",
  version: "1.0.0",
  description: "Complete tutoring business management with scheduling, payments, and communications",
  author: "Struere",
  license: "MIT",

  entityTypes: [
    {
      name: "Teacher",
      slug: "teacher",
      schema: { /* ... */ },
    },
    {
      name: "Student",
      slug: "student",
      schema: { /* ... */ },
    },
    // ... other entity types
  ],

  roles: [
    {
      name: "admin",
      description: "Full access",
      isSystem: false,
    },
    {
      name: "teacher",
      description: "Teaching staff",
      isSystem: false,
    },
    {
      name: "guardian",
      description: "Parents/guardians",
      isSystem: false,
    },
  ],

  policies: [
    { role: "admin", resource: "*", action: "*", effect: "allow" },
    { role: "teacher", resource: "session", action: "list", effect: "allow" },
    { role: "teacher", resource: "session", action: "read", effect: "allow" },
    // ... other policies
  ],

  scopeRules: [
    {
      role: "teacher",
      entityType: "session",
      type: "field_match",
      fieldPath: "data.teacherId",
      operator: "eq",
      valuePath: "actor.userId",
    },
    // ... other scope rules
  ],

  fieldMasks: [
    {
      role: "teacher",
      entityType: "session",
      mode: "whitelist",
      fields: ["_id", "status", "data.studentId", "data.startTime", "data.duration"],
    },
    // ... other field masks
  ],

  jobTypes: [
    {
      name: "session.reminder",
      description: "Send session reminder",
      handler: "sessionReminderHandler",
    },
  ],

  migrations: [],

  hooks: {
    postInstall: "createDefaultAdminRole",
  },
}
```

---

## Pack Versioning

### Semantic Versioning

Packs use semantic versioning (semver):
- **MAJOR**: Breaking changes (schema incompatible)
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

Example version history:
- `1.0.0` - Initial release
- `1.0.1` - Fix field mask typo
- `1.1.0` - Add `entitlement.renewalDate` field
- `2.0.0` - Restructure session schema (breaking)

### Version Comparison

```typescript
function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = a.split(".").map(Number)
  const [bMajor, bMinor, bPatch] = b.split(".").map(Number)

  if (aMajor !== bMajor) return aMajor - bMajor
  if (aMinor !== bMinor) return aMinor - bMinor
  return aPatch - bPatch
}

function isUpgrade(from: string, to: string): boolean {
  return compareVersions(to, from) > 0
}

function isMajorUpgrade(from: string, to: string): boolean {
  const [fromMajor] = from.split(".").map(Number)
  const [toMajor] = to.split(".").map(Number)
  return toMajor > fromMajor
}
```

---

## Installation Tracking

### Data Model: Installed Packs

**Table**: `installedPacks` (already exists, enhanced)

```typescript
{
  organizationId: Id<"organizations">,
  packId: string,
  version: string,
  installedAt: number,
  installedBy: Id<"users">,
  status: "active" | "upgrading" | "failed",
  customizations: {
    entityTypes: string[],  // Slugs of customized entity types
    roles: string[],        // Names of customized roles
    policies: string[],     // IDs of custom policies
  },
  lastUpgradedAt: number | null,
  lastUpgradedBy: Id<"users"> | null,
  upgradeHistory: {
    fromVersion: string,
    toVersion: string,
    upgradedAt: number,
    upgradedBy: Id<"users">,
  }[],
}
```

**Why track customizations?**

When upgrading, we need to know:
- Which entity types were modified by the user
- Which roles have custom policies
- What should NOT be overwritten

---

## Migration System

### Migration Definition

```typescript
interface Migration {
  fromVersion: string
  toVersion: string
  steps: MigrationStep[]
}

type MigrationStep =
  | AddFieldStep
  | RemoveFieldStep
  | RenameFieldStep
  | AddEntityTypeStep
  | ModifySchemaStep
  | RunScriptStep

interface AddFieldStep {
  type: "add_field"
  entityType: string
  field: string
  defaultValue: unknown
}

interface RemoveFieldStep {
  type: "remove_field"
  entityType: string
  field: string
}

interface RenameFieldStep {
  type: "rename_field"
  entityType: string
  oldField: string
  newField: string
}

interface AddEntityTypeStep {
  type: "add_entity_type"
  entityType: EntityTypeDefinition
}

interface ModifySchemaStep {
  type: "modify_schema"
  entityType: string
  schemaChanges: Record<string, unknown>
}

interface RunScriptStep {
  type: "run_script"
  script: string  // Function name in pack
}
```

### Example Migration: v1.0.0 → v1.1.0

```typescript
{
  fromVersion: "1.0.0",
  toVersion: "1.1.0",
  steps: [
    {
      type: "add_field",
      entityType: "entitlement",
      field: "renewalDate",
      defaultValue: null,
    },
    {
      type: "add_field",
      entityType: "session",
      field: "reminderSent",
      defaultValue: false,
    },
  ],
}
```

### Example Migration: v1.1.0 → v2.0.0

```typescript
{
  fromVersion: "1.1.0",
  toVersion: "2.0.0",
  steps: [
    {
      type: "rename_field",
      entityType: "session",
      oldField: "teacherNotes",
      newField: "internalNotes",
    },
    {
      type: "add_entity_type",
      entityType: {
        name: "SessionFeedback",
        slug: "session_feedback",
        schema: { /* ... */ },
      },
    },
    {
      type: "run_script",
      script: "migrateSessionNotesToFeedback",
    },
  ],
}
```

### Migration Execution

**File**: `platform/convex/lib/packs/migrate.ts`

```typescript
export async function migratePack(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  packId: string,
  toVersion: string
): Promise<void> {
  const installed = await ctx.db
    .query("installedPacks")
    .withIndex("by_org_pack", (q) =>
      q.eq("organizationId", organizationId).eq("packId", packId)
    )
    .first()

  if (!installed) {
    throw new Error(`Pack ${packId} is not installed`)
  }

  const pack = getPackDefinition(packId)
  const fromVersion = installed.version

  if (!isUpgrade(fromVersion, toVersion)) {
    throw new Error(`Cannot migrate from ${fromVersion} to ${toVersion}`)
  }

  await ctx.db.patch(installed._id, { status: "upgrading" })

  try {
    const migrations = findMigrationPath(pack.migrations, fromVersion, toVersion)

    for (const migration of migrations) {
      await executeMigration(ctx, organizationId, pack, migration, installed.customizations)
    }

    await ctx.db.patch(installed._id, {
      version: toVersion,
      status: "active",
      lastUpgradedAt: Date.now(),
      upgradeHistory: [
        ...installed.upgradeHistory,
        {
          fromVersion,
          toVersion,
          upgradedAt: Date.now(),
          upgradedBy: ctx.auth.userId,
        },
      ],
    })
  } catch (error) {
    await ctx.db.patch(installed._id, { status: "failed" })
    throw error
  }
}

function findMigrationPath(
  migrations: Migration[],
  from: string,
  to: string
): Migration[] {
  const path: Migration[] = []
  let current = from

  while (current !== to) {
    const next = migrations.find((m) => m.fromVersion === current)
    if (!next) {
      throw new Error(`No migration path from ${current} to ${to}`)
    }
    path.push(next)
    current = next.toVersion
  }

  return path
}

async function executeMigration(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  pack: PackDefinition,
  migration: Migration,
  customizations: Customizations
): Promise<void> {
  for (const step of migration.steps) {
    await executeMigrationStep(ctx, organizationId, pack, step, customizations)
  }
}

async function executeMigrationStep(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  pack: PackDefinition,
  step: MigrationStep,
  customizations: Customizations
): Promise<void> {
  switch (step.type) {
    case "add_field":
      if (customizations.entityTypes.includes(step.entityType)) {
        console.log(`Skipping add_field for customized entity type: ${step.entityType}`)
        return
      }
      await addFieldToEntities(ctx, organizationId, step.entityType, step.field, step.defaultValue)
      break

    case "remove_field":
      await removeFieldFromEntities(ctx, organizationId, step.entityType, step.field)
      break

    case "rename_field":
      await renameFieldInEntities(ctx, organizationId, step.entityType, step.oldField, step.newField)
      break

    case "add_entity_type":
      await createEntityType(ctx, organizationId, step.entityType)
      break

    case "modify_schema":
      await updateEntityTypeSchema(ctx, organizationId, step.entityType, step.schemaChanges)
      break

    case "run_script":
      const scriptFn = pack.migrationScripts?.[step.script]
      if (scriptFn) {
        await scriptFn(ctx, organizationId)
      }
      break
  }
}
```

### Field Migration Helpers

```typescript
async function addFieldToEntities(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityTypeSlug: string,
  field: string,
  defaultValue: unknown
): Promise<void> {
  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) return

  const entities = await ctx.db
    .query("entities")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("entityTypeId"), entityType._id))
    .collect()

  for (const entity of entities) {
    if (!(field in entity.data)) {
      await ctx.db.patch(entity._id, {
        data: { ...entity.data, [field]: defaultValue },
        updatedAt: Date.now(),
      })
    }
  }
}

async function renameFieldInEntities(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entityTypeSlug: string,
  oldField: string,
  newField: string
): Promise<void> {
  const entityType = await ctx.db
    .query("entityTypes")
    .withIndex("by_org_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", entityTypeSlug)
    )
    .first()

  if (!entityType) return

  const entities = await ctx.db
    .query("entities")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("entityTypeId"), entityType._id))
    .collect()

  for (const entity of entities) {
    if (oldField in entity.data) {
      const newData = { ...entity.data }
      newData[newField] = newData[oldField]
      delete newData[oldField]
      await ctx.db.patch(entity._id, {
        data: newData,
        updatedAt: Date.now(),
      })
    }
  }
}
```

---

## Customization Preservation

### Tracking Customizations

When a user modifies a pack-installed entity type:

```typescript
export const updateEntityType = mutation({
  args: { id: v.id("entityTypes"), changes: v.any() },
  handler: async (ctx, args) => {
    const entityType = await ctx.db.get(args.id)
    if (!entityType) throw new Error("Not found")

    await ctx.db.patch(args.id, args.changes)

    const installed = await ctx.db
      .query("installedPacks")
      .withIndex("by_org", (q) => q.eq("organizationId", entityType.organizationId))
      .filter((q) => q.eq(q.field("packId"), entityType.packId))
      .first()

    if (installed && !installed.customizations.entityTypes.includes(entityType.slug)) {
      await ctx.db.patch(installed._id, {
        customizations: {
          ...installed.customizations,
          entityTypes: [...installed.customizations.entityTypes, entityType.slug],
        },
      })
    }
  },
})
```

### Upgrade Behavior with Customizations

When upgrading, customized items are skipped:

```typescript
// In migration step execution
if (customizations.entityTypes.includes(step.entityType)) {
  console.log(`Skipping migration for customized entity type: ${step.entityType}`)
  return
}
```

### Manual Merge Option

For major upgrades, offer manual merge:

```typescript
interface UpgradePreview {
  automaticChanges: MigrationStep[]
  skippedDueToCustomization: MigrationStep[]
  requiresManualReview: MigrationStep[]
}

export async function previewUpgrade(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  packId: string,
  toVersion: string
): Promise<UpgradePreview> {
  // ... analyze what would change and what's customized
}
```

---

## Pack Catalog

### Available Packs Query

```typescript
export const listAvailablePacks = query({
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx)

    const installedPacks = await ctx.db
      .query("installedPacks")
      .withIndex("by_org", (q) => q.eq("organizationId", auth.organizationId))
      .collect()

    const installedIds = new Set(installedPacks.map((p) => p.packId))

    return getAllPackDefinitions().map((pack) => ({
      ...pack,
      isInstalled: installedIds.has(pack.id),
      installedVersion: installedPacks.find((p) => p.packId === pack.id)?.version,
      hasUpgrade: installedPacks.find((p) => p.packId === pack.id)
        ? isUpgrade(
            installedPacks.find((p) => p.packId === pack.id)!.version,
            pack.version
          )
        : false,
    }))
  },
})
```

### Pack Detail Query

```typescript
export const getPackDetail = query({
  args: { packId: v.string() },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx)

    const pack = getPackDefinition(args.packId)
    if (!pack) return null

    const installed = await ctx.db
      .query("installedPacks")
      .withIndex("by_org_pack", (q) =>
        q.eq("organizationId", auth.organizationId).eq("packId", args.packId)
      )
      .first()

    return {
      ...pack,
      isInstalled: !!installed,
      installedVersion: installed?.version,
      customizations: installed?.customizations,
      upgradeHistory: installed?.upgradeHistory,
    }
  },
})
```

---

## Installation UI

### Pack Catalog Page

**Route**: `/settings/packs`

```typescript
export default function PacksPage() {
  const packs = useAvailablePacks()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Solution Packs</h1>

      <div className="grid grid-cols-2 gap-4">
        {packs?.map((pack) => (
          <PackCard key={pack.id} pack={pack} />
        ))}
      </div>
    </div>
  )
}

function PackCard({ pack }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{pack.name}</CardTitle>
        <CardDescription>{pack.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-500 mb-4">
          Version: {pack.version}
        </div>

        {pack.isInstalled ? (
          <div className="flex items-center justify-between">
            <span className="text-green-600 flex items-center">
              <CheckCircle className="w-4 h-4 mr-1" />
              Installed (v{pack.installedVersion})
            </span>

            {pack.hasUpgrade && (
              <Button size="sm" onClick={() => openUpgradeModal(pack)}>
                Upgrade to {pack.version}
              </Button>
            )}
          </div>
        ) : (
          <Button onClick={() => openInstallModal(pack)}>
            Install Pack
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

### Install Confirmation Modal

```typescript
function InstallPackModal({ pack, onClose }) {
  const installPack = useInstallPack()
  const [installing, setInstalling] = useState(false)

  const handleInstall = async () => {
    setInstalling(true)
    try {
      await installPack({ packId: pack.id })
      toast.success(`${pack.name} installed successfully!`)
      onClose()
    } catch (error) {
      toast.error(`Installation failed: ${error.message}`)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install {pack.name}?</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="mb-4">This will create:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{pack.entityTypes.length} entity types</li>
            <li>{pack.roles.length} roles</li>
            <li>{pack.policies.length} policies</li>
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleInstall} disabled={installing}>
            {installing ? "Installing..." : "Install"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Upgrade Preview Modal

```typescript
function UpgradePackModal({ pack, onClose }) {
  const preview = useUpgradePreview(pack.id, pack.version)
  const upgradePack = useUpgradePack()

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Upgrade {pack.name} to v{pack.version}?
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {preview?.automaticChanges.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2">Automatic Changes:</h4>
              <ul className="list-disc pl-6 text-sm">
                {preview.automaticChanges.map((change, i) => (
                  <li key={i}>{describeChange(change)}</li>
                ))}
              </ul>
            </div>
          )}

          {preview?.skippedDueToCustomization.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
              <h4 className="font-medium mb-2 text-yellow-800">
                Skipped (customized):
              </h4>
              <ul className="list-disc pl-6 text-sm text-yellow-700">
                {preview.skippedDueToCustomization.map((change, i) => (
                  <li key={i}>{describeChange(change)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => upgradePack({ packId: pack.id, toVersion: pack.version })}>
            Upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Testing Strategy

### Pack Installation Tests

1. **Fresh installation**
   - Install pack on org with no prior data
   - Assert all entity types, roles, policies created

2. **Duplicate installation prevented**
   - Attempt to install already-installed pack
   - Assert error

### Migration Tests

1. **Simple field addition**
   - Install v1.0.0
   - Upgrade to v1.1.0 (adds field)
   - Assert field added to existing entities

2. **Field rename**
   - Install v1.0.0
   - Create entity with old field
   - Upgrade to v2.0.0 (renames field)
   - Assert field renamed in entity

3. **Customization preserved**
   - Install pack
   - Customize entity type
   - Upgrade pack
   - Assert customized entity type unchanged

### Version Path Tests

1. **Direct upgrade**
   - v1.0.0 → v2.0.0 when migration path exists

2. **Step-by-step upgrade**
   - v1.0.0 → v1.1.0 → v2.0.0 when no direct path

3. **No path error**
   - v1.0.0 → v3.0.0 when v2.0.0 migration missing
   - Assert error

---

## Success Criteria

Phase 7 is complete when:

1. ✅ Packs have semantic versions
2. ✅ Installation tracks version and customizations
3. ✅ Migrations execute correctly (add/remove/rename fields)
4. ✅ Customizations are preserved during upgrades
5. ✅ Pack catalog shows available and installed packs
6. ✅ Installation UI works
7. ✅ Upgrade preview shows changes
8. ✅ All tests pass

---

## Files Created/Modified

| Path | Changes |
|------|---------|
| `platform/convex/lib/packs/types.ts` | NEW: Enhanced pack type definitions |
| `platform/convex/lib/packs/migrate.ts` | NEW: Migration execution logic |
| `platform/convex/lib/packs/version.ts` | NEW: Version comparison utilities |
| `platform/convex/packs.ts` | Add upgrade mutation, preview query |
| `platform/convex/packs/tutoring.ts` | Add migrations array |
| `apps/dashboard/src/app/(dashboard)/settings/packs/*` | NEW: Pack management UI |

---

## Future Considerations

### Pack Marketplace (Phase 8+)

- Public pack registry
- Pack discovery and ratings
- Third-party pack submissions
- Pack monetization

### Pack Dependencies

- Pack A requires Pack B
- Dependency resolution
- Version compatibility matrix

### Pack Testing Framework

- Automated pack validation
- Schema compatibility checks
- Migration dry-run

---

## What's Next

This completes the core roadmap. Future phases might include:

- **Phase 8**: Guardian self-service portal
- **Phase 9**: Advanced analytics and reporting
- **Phase 10**: Multi-language and localization
- **Phase 11**: Pack marketplace

See the [Glossary](./09-glossary.md) for term definitions used throughout this roadmap.
