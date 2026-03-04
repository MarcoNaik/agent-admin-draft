import { describe, expect, test } from "bun:test"
import { defineRole } from "../role"

const validRole = {
  name: "Teacher",
  description: "Can manage students and sessions",
  policies: [
    {
      resource: "student",
      actions: ["read", "update"],
      effect: "allow" as const,
    },
  ],
}

describe("defineRole", () => {
  test("returns config with empty scopeRules when none provided", () => {
    const config = defineRole(validRole)
    expect(config.scopeRules).toEqual([])
    expect(config.fieldMasks).toEqual([])
  })

  test("throws when name is missing", () => {
    expect(() =>
      defineRole({
        ...validRole,
        name: "",
      })
    ).toThrow("Role name is required")
  })

  test("throws when policies is empty", () => {
    expect(() =>
      defineRole({
        ...validRole,
        policies: [],
      })
    ).toThrow("Role must have at least one policy")
  })

  test("throws when policy resource is missing", () => {
    expect(() =>
      defineRole({
        name: "Teacher",
        policies: [
          {
            resource: "",
            actions: ["read"],
            effect: "allow" as const,
          },
        ],
      })
    ).toThrow("Policy resource is required")
  })

  test("throws when policy effect is missing", () => {
    expect(() =>
      defineRole({
        name: "Teacher",
        policies: [
          {
            resource: "student",
            actions: ["read"],
            effect: "" as any,
          },
        ],
      })
    ).toThrow("Policy effect is required")
  })

  test("throws when policy actions is empty", () => {
    expect(() =>
      defineRole({
        name: "Teacher",
        policies: [
          {
            resource: "student",
            actions: [],
            effect: "allow" as const,
          },
        ],
      })
    ).toThrow("Policy must have at least one action")
  })

  test("preserves provided scopeRules and fieldMasks", () => {
    const config = defineRole({
      ...validRole,
      scopeRules: [
        {
          entityType: "student",
          field: "teacherId",
          operator: "eq" as const,
          value: "{{actor.id}}",
        },
      ],
      fieldMasks: [
        {
          entityType: "student",
          fieldPath: "ssn",
          maskType: "hide" as const,
        },
      ],
    })
    expect(config.scopeRules).toHaveLength(1)
    expect(config.scopeRules![0].entityType).toBe("student")
    expect(config.fieldMasks).toHaveLength(1)
    expect(config.fieldMasks![0].fieldPath).toBe("ssn")
  })
})
