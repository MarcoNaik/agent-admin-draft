import { describe, expect, test } from "bun:test"
import { defineTrigger } from "../trigger"

const validTrigger = {
  name: "On Student Created",
  slug: "on-student-created",
  on: {
    entityType: "student",
    action: "created" as const,
  },
  actions: [
    {
      tool: "event.emit",
      args: { eventType: "student.welcome" },
    },
  ],
}

describe("defineTrigger", () => {
  test("returns valid config for correct input", () => {
    const config = defineTrigger(validTrigger)
    expect(config.name).toBe("On Student Created")
    expect(config.slug).toBe("on-student-created")
    expect(config.on.entityType).toBe("student")
    expect(config.on.action).toBe("created")
    expect(config.actions).toHaveLength(1)
    expect(config.actions[0].tool).toBe("event.emit")
  })

  test("throws when name is missing", () => {
    expect(() =>
      defineTrigger({
        ...validTrigger,
        name: "",
      })
    ).toThrow("Trigger name is required")
  })

  test("throws when slug is missing", () => {
    expect(() =>
      defineTrigger({
        ...validTrigger,
        slug: "",
      })
    ).toThrow("Trigger slug is required")
  })

  test("throws when on.entityType is missing", () => {
    expect(() =>
      defineTrigger({
        ...validTrigger,
        on: { ...validTrigger.on, entityType: "" },
      })
    ).toThrow("Trigger entityType is required")
  })

  test("throws when on.action is invalid", () => {
    expect(() =>
      defineTrigger({
        ...validTrigger,
        on: { entityType: "student", action: "archived" as any },
      })
    ).toThrow("Trigger action must be one of: created, updated, deleted")
  })

  test("throws when actions array is empty", () => {
    expect(() =>
      defineTrigger({
        ...validTrigger,
        actions: [],
      })
    ).toThrow("Trigger must have at least one action")
  })

  test("throws when action tool is missing", () => {
    expect(() =>
      defineTrigger({
        ...validTrigger,
        actions: [{ tool: "", args: { key: "value" } }],
      })
    ).toThrow("Trigger action tool is required")
  })

  test("throws when action args is not an object", () => {
    expect(() =>
      defineTrigger({
        ...validTrigger,
        actions: [{ tool: "event.emit", args: null as any }],
      })
    ).toThrow("Trigger action args must be an object")
  })
})
