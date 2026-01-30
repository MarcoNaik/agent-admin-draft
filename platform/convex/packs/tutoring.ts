import { PackDefinition } from "./index"

export const tutoringPack: PackDefinition = {
  id: "tutoring",
  name: "Tutoring Operations",
  version: "1.0.0",
  description: "Complete tutoring business management with students, teachers, sessions, payments, and entitlements",
  entityTypes: [
    {
      name: "Student",
      slug: "student",
      description: "A student receiving tutoring services",
      schema: {
        type: "object",
        properties: {
          firstName: { type: "string", minLength: 1, maxLength: 100 },
          lastName: { type: "string", minLength: 1, maxLength: 100 },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          grade: { type: "string" },
          school: { type: "string", maxLength: 200 },
        },
        required: ["firstName", "lastName"],
      },
      searchFields: ["firstName", "lastName", "email", "school"],
      displayConfig: {
        listFields: ["firstName", "lastName", "grade", "school"],
        detailFields: ["firstName", "lastName", "email", "phone", "grade", "school"],
      },
    },
    {
      name: "Guardian",
      slug: "guardian",
      description: "A parent or guardian responsible for a student",
      schema: {
        type: "object",
        properties: {
          firstName: { type: "string", minLength: 1, maxLength: 100 },
          lastName: { type: "string", minLength: 1, maxLength: 100 },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          relationship: {
            type: "string",
            enum: ["mother", "father", "stepmother", "stepfather", "grandmother", "grandfather", "aunt", "uncle", "legal_guardian", "other"],
          },
        },
        required: ["firstName", "lastName", "email", "relationship"],
      },
      searchFields: ["firstName", "lastName", "email"],
      displayConfig: {
        listFields: ["firstName", "lastName", "email", "relationship"],
        detailFields: ["firstName", "lastName", "email", "phone", "relationship"],
      },
    },
    {
      name: "Teacher",
      slug: "teacher",
      description: "A tutor or teacher providing tutoring services",
      schema: {
        type: "object",
        properties: {
          firstName: { type: "string", minLength: 1, maxLength: 100 },
          lastName: { type: "string", minLength: 1, maxLength: 100 },
          email: { type: "string", format: "email" },
          subjects: { type: "array", items: { type: "string" }, minItems: 1 },
          hourlyRate: { type: "number", minimum: 0 },
        },
        required: ["firstName", "lastName", "email", "subjects", "hourlyRate"],
      },
      searchFields: ["firstName", "lastName", "email"],
      displayConfig: {
        listFields: ["firstName", "lastName", "email", "subjects"],
        detailFields: ["firstName", "lastName", "email", "subjects", "hourlyRate"],
      },
    },
    {
      name: "Session",
      slug: "session",
      description: "A scheduled tutoring session",
      schema: {
        type: "object",
        properties: {
          subject: { type: "string", minLength: 1, maxLength: 100 },
          scheduledAt: { type: "string", format: "date-time" },
          durationMinutes: { type: "integer", minimum: 15, maximum: 480, default: 60 },
          location: { type: "string", maxLength: 500 },
          notes: { type: "string", maxLength: 2000 },
        },
        required: ["subject", "scheduledAt", "durationMinutes"],
      },
      searchFields: ["subject", "location", "notes"],
      displayConfig: {
        listFields: ["subject", "scheduledAt", "durationMinutes", "location"],
        detailFields: ["subject", "scheduledAt", "durationMinutes", "location", "notes"],
      },
    },
    {
      name: "Payment",
      slug: "payment",
      description: "A payment transaction for tutoring services",
      schema: {
        type: "object",
        properties: {
          amount: { type: "number", minimum: 0 },
          currency: { type: "string", default: "USD" },
          method: {
            type: "string",
            enum: ["credit_card", "debit_card", "bank_transfer", "cash", "check", "paypal", "venmo", "zelle", "other"],
          },
          paidAt: { type: "string", format: "date-time" },
          description: { type: "string", maxLength: 500 },
        },
        required: ["amount", "currency", "method"],
      },
      searchFields: ["description"],
      displayConfig: {
        listFields: ["amount", "method", "paidAt"],
        detailFields: ["amount", "currency", "method", "paidAt", "description"],
      },
    },
    {
      name: "Entitlement",
      slug: "entitlement",
      description: "A session pack or credit entitlement",
      schema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["single_session", "pack_5", "pack_10", "pack_20", "monthly_unlimited", "custom"],
          },
          sessionsRemaining: { type: "integer", minimum: 0 },
          sessionsTotal: { type: "integer", minimum: 1 },
          expiresAt: { type: "string", format: "date-time" },
          purchasedAt: { type: "string", format: "date-time" },
          notes: { type: "string", maxLength: 500 },
        },
        required: ["type", "purchasedAt"],
      },
      searchFields: ["type", "notes"],
      displayConfig: {
        listFields: ["type", "sessionsRemaining", "sessionsTotal", "expiresAt"],
        detailFields: ["type", "sessionsRemaining", "sessionsTotal", "expiresAt", "purchasedAt", "notes"],
      },
    },
  ],
  roles: [
    {
      name: "admin",
      description: "Full administrative access to all tutoring resources",
      isSystem: true,
      policies: [
        { resource: "*", actions: ["create", "read", "update", "delete", "list"], effect: "allow", priority: 100 },
      ],
    },
    {
      name: "teacher",
      description: "Teacher access to their own sessions and students",
      isSystem: true,
      policies: [
        { resource: "teacher", actions: ["read", "update"], effect: "allow", priority: 50 },
        { resource: "session", actions: ["read", "list", "update"], effect: "allow", priority: 50 },
        { resource: "student", actions: ["read", "list"], effect: "allow", priority: 50 },
        { resource: "payment", actions: ["read", "list", "create", "update", "delete"], effect: "deny", priority: 100 },
        { resource: "entitlement", actions: ["read", "list", "create", "update", "delete"], effect: "deny", priority: 100 },
      ],
    },
    {
      name: "guardian",
      description: "Guardian access to their own students and sessions",
      isSystem: true,
      policies: [
        { resource: "guardian", actions: ["read", "update"], effect: "allow", priority: 50 },
        { resource: "student", actions: ["read", "list"], effect: "allow", priority: 50 },
        { resource: "session", actions: ["read", "list"], effect: "allow", priority: 50 },
        { resource: "teacher", actions: ["read"], effect: "allow", priority: 50 },
        { resource: "payment", actions: ["read", "list"], effect: "allow", priority: 50 },
        { resource: "entitlement", actions: ["read", "list"], effect: "allow", priority: 50 },
        { resource: "*", actions: ["create", "delete"], effect: "deny", priority: 100 },
      ],
    },
  ],
}
