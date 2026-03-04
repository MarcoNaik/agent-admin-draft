import { describe, expect, test } from "bun:test"
import { defineData } from "../entityType"

const validSchema = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const, description: "Name" },
    age: { type: "number" as const, description: "Age" },
  },
  required: ["name"],
}

describe("defineData", () => {
  test("returns config with empty searchFields when none provided", () => {
    const config = defineData({
      name: "Student",
      slug: "student",
      schema: validSchema,
    })
    expect(config.searchFields).toEqual([])
  })

  test("throws when name is missing", () => {
    expect(() =>
      defineData({
        name: "",
        slug: "student",
        schema: validSchema,
      })
    ).toThrow("Data type name is required")
  })

  test("throws when slug is missing", () => {
    expect(() =>
      defineData({
        name: "Student",
        slug: "",
        schema: validSchema,
      })
    ).toThrow("Data type slug is required")
  })

  test("throws when schema is missing", () => {
    expect(() =>
      defineData({
        name: "Student",
        slug: "student",
        schema: undefined as any,
      })
    ).toThrow("Data type schema is required")
  })

  test("throws when schema type is not object", () => {
    expect(() =>
      defineData({
        name: "Student",
        slug: "student",
        schema: { type: "string" as any, properties: {} },
      })
    ).toThrow("Data type schema must be an object type")
  })

  test("sets default userIdField to userId when boundToRole is set", () => {
    const config = defineData({
      name: "Student",
      slug: "student",
      schema: validSchema,
      boundToRole: "guardian",
    })
    expect(config.userIdField).toBe("userId")
  })

  test("preserves explicit userIdField when boundToRole is set", () => {
    const config = defineData({
      name: "Student",
      slug: "student",
      schema: validSchema,
      boundToRole: "guardian",
      userIdField: "ownerId",
    })
    expect(config.userIdField).toBe("ownerId")
  })

  test("userIdField is undefined when boundToRole is not set", () => {
    const config = defineData({
      name: "Student",
      slug: "student",
      schema: validSchema,
    })
    expect(config.userIdField).toBeUndefined()
  })

  test("preserves provided searchFields", () => {
    const config = defineData({
      name: "Student",
      slug: "student",
      schema: validSchema,
      searchFields: ["name"],
    })
    expect(config.searchFields).toEqual(["name"])
  })

  test("throws when nested object property lacks properties", () => {
    expect(() =>
      defineData({
        name: "Student",
        slug: "student",
        schema: {
          type: "object",
          properties: {
            address: { type: "object" as const, description: "Address" },
          },
        },
      })
    ).toThrow('Schema field "address" has type "object" but is missing "properties"')
  })
})
