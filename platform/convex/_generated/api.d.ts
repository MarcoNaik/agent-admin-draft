/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agents from "../agents.js";
import type * as apiKeys from "../apiKeys.js";
import type * as billing from "../billing.js";
import type * as calendar from "../calendar.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as entities from "../entities.js";
import type * as entityTypes from "../entityTypes.js";
import type * as evalRunner from "../evalRunner.js";
import type * as evals from "../evals.js";
import type * as events from "../events.js";
import type * as executions from "../executions.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_cleanup from "../lib/cleanup.js";
import type * as lib_entityMutations from "../lib/entityMutations.js";
import type * as lib_integrations_airtable from "../lib/integrations/airtable.js";
import type * as lib_integrations_flow from "../lib/integrations/flow.js";
import type * as lib_integrations_googleCalendar from "../lib/integrations/googleCalendar.js";
import type * as lib_integrations_jina from "../lib/integrations/jina.js";
import type * as lib_integrations_kapso from "../lib/integrations/kapso.js";
import type * as lib_integrations_resend from "../lib/integrations/resend.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_permissions_context from "../lib/permissions/context.js";
import type * as lib_permissions_evaluate from "../lib/permissions/evaluate.js";
import type * as lib_permissions_index from "../lib/permissions/index.js";
import type * as lib_permissions_mask from "../lib/permissions/mask.js";
import type * as lib_permissions_scope from "../lib/permissions/scope.js";
import type * as lib_permissions_tools from "../lib/permissions/tools.js";
import type * as lib_permissions_types from "../lib/permissions/types.js";
import type * as lib_providers from "../lib/providers.js";
import type * as lib_sync_agents from "../lib/sync/agents.js";
import type * as lib_sync_entityTypes from "../lib/sync/entityTypes.js";
import type * as lib_sync_evalSuites from "../lib/sync/evalSuites.js";
import type * as lib_sync_fixtures from "../lib/sync/fixtures.js";
import type * as lib_sync_index from "../lib/sync/index.js";
import type * as lib_sync_roles from "../lib/sync/roles.js";
import type * as lib_sync_triggers from "../lib/sync/triggers.js";
import type * as lib_templateEngine from "../lib/templateEngine.js";
import type * as lib_toolExecution from "../lib/toolExecution.js";
import type * as lib_triggers from "../lib/triggers.js";
import type * as lib_utils from "../lib/utils.js";
import type * as lib_whatsappPricing from "../lib/whatsappPricing.js";
import type * as migrations from "../migrations.js";
import type * as migrations_addEnvironment from "../migrations/addEnvironment.js";
import type * as migrations_backfillContactNames from "../migrations/backfillContactNames.js";
import type * as migrations_backfillContactNamesHelper from "../migrations/backfillContactNamesHelper.js";
import type * as migrations_backfillCostRollups from "../migrations/backfillCostRollups.js";
import type * as migrations_backfillPhoneNumbers from "../migrations/backfillPhoneNumbers.js";
import type * as migrations_backfillPhoneNumbersHelper from "../migrations/backfillPhoneNumbersHelper.js";
import type * as migrations_centsToMicrodollars from "../migrations/centsToMicrodollars.js";
import type * as migrations_clearReservedCredits from "../migrations/clearReservedCredits.js";
import type * as migrations_debugTemplateOnly from "../migrations/debugTemplateOnly.js";
import type * as migrations_debugTemplates from "../migrations/debugTemplates.js";
import type * as migrations_deleteBaileysConnections from "../migrations/deleteBaileysConnections.js";
import type * as migrations_migrateOwnedTemplates from "../migrations/migrateOwnedTemplates.js";
import type * as migrations_registerMathlandTemplates from "../migrations/registerMathlandTemplates.js";
import type * as migrations_syncKapsoTemplates from "../migrations/syncKapsoTemplates.js";
import type * as migrations_syncKapsoTemplatesHelper from "../migrations/syncKapsoTemplatesHelper.js";
import type * as modelPricing from "../modelPricing.js";
import type * as orgKeys from "../orgKeys.js";
import type * as organizations from "../organizations.js";
import type * as payments from "../payments.js";
import type * as permissions from "../permissions.js";
import type * as providers from "../providers.js";
import type * as publicChat from "../publicChat.js";
import type * as rateLimits from "../rateLimits.js";
import type * as roles from "../roles.js";
import type * as sandboxSessions from "../sandboxSessions.js";
import type * as sync from "../sync.js";
import type * as threads from "../threads.js";
import type * as toolTesting from "../toolTesting.js";
import type * as tools_agents from "../tools/agents.js";
import type * as tools_airtable from "../tools/airtable.js";
import type * as tools_calendar from "../tools/calendar.js";
import type * as tools_email from "../tools/email.js";
import type * as tools_entities from "../tools/entities.js";
import type * as tools_events from "../tools/events.js";
import type * as tools_flow from "../tools/flow.js";
import type * as tools_helpers from "../tools/helpers.js";
import type * as tools_index from "../tools/index.js";
import type * as tools_web from "../tools/web.js";
import type * as tools_whatsapp from "../tools/whatsapp.js";
import type * as triggers from "../triggers.js";
import type * as users from "../users.js";
import type * as whatsapp from "../whatsapp.js";
import type * as whatsappActions from "../whatsappActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agents: typeof agents;
  apiKeys: typeof apiKeys;
  billing: typeof billing;
  calendar: typeof calendar;
  chat: typeof chat;
  crons: typeof crons;
  email: typeof email;
  entities: typeof entities;
  entityTypes: typeof entityTypes;
  evalRunner: typeof evalRunner;
  evals: typeof evals;
  events: typeof events;
  executions: typeof executions;
  http: typeof http;
  integrations: typeof integrations;
  "lib/auth": typeof lib_auth;
  "lib/cleanup": typeof lib_cleanup;
  "lib/entityMutations": typeof lib_entityMutations;
  "lib/integrations/airtable": typeof lib_integrations_airtable;
  "lib/integrations/flow": typeof lib_integrations_flow;
  "lib/integrations/googleCalendar": typeof lib_integrations_googleCalendar;
  "lib/integrations/jina": typeof lib_integrations_jina;
  "lib/integrations/kapso": typeof lib_integrations_kapso;
  "lib/integrations/resend": typeof lib_integrations_resend;
  "lib/llm": typeof lib_llm;
  "lib/logger": typeof lib_logger;
  "lib/permissions/context": typeof lib_permissions_context;
  "lib/permissions/evaluate": typeof lib_permissions_evaluate;
  "lib/permissions/index": typeof lib_permissions_index;
  "lib/permissions/mask": typeof lib_permissions_mask;
  "lib/permissions/scope": typeof lib_permissions_scope;
  "lib/permissions/tools": typeof lib_permissions_tools;
  "lib/permissions/types": typeof lib_permissions_types;
  "lib/providers": typeof lib_providers;
  "lib/sync/agents": typeof lib_sync_agents;
  "lib/sync/entityTypes": typeof lib_sync_entityTypes;
  "lib/sync/evalSuites": typeof lib_sync_evalSuites;
  "lib/sync/fixtures": typeof lib_sync_fixtures;
  "lib/sync/index": typeof lib_sync_index;
  "lib/sync/roles": typeof lib_sync_roles;
  "lib/sync/triggers": typeof lib_sync_triggers;
  "lib/templateEngine": typeof lib_templateEngine;
  "lib/toolExecution": typeof lib_toolExecution;
  "lib/triggers": typeof lib_triggers;
  "lib/utils": typeof lib_utils;
  "lib/whatsappPricing": typeof lib_whatsappPricing;
  migrations: typeof migrations;
  "migrations/addEnvironment": typeof migrations_addEnvironment;
  "migrations/backfillContactNames": typeof migrations_backfillContactNames;
  "migrations/backfillContactNamesHelper": typeof migrations_backfillContactNamesHelper;
  "migrations/backfillCostRollups": typeof migrations_backfillCostRollups;
  "migrations/backfillPhoneNumbers": typeof migrations_backfillPhoneNumbers;
  "migrations/backfillPhoneNumbersHelper": typeof migrations_backfillPhoneNumbersHelper;
  "migrations/centsToMicrodollars": typeof migrations_centsToMicrodollars;
  "migrations/clearReservedCredits": typeof migrations_clearReservedCredits;
  "migrations/debugTemplateOnly": typeof migrations_debugTemplateOnly;
  "migrations/debugTemplates": typeof migrations_debugTemplates;
  "migrations/deleteBaileysConnections": typeof migrations_deleteBaileysConnections;
  "migrations/migrateOwnedTemplates": typeof migrations_migrateOwnedTemplates;
  "migrations/registerMathlandTemplates": typeof migrations_registerMathlandTemplates;
  "migrations/syncKapsoTemplates": typeof migrations_syncKapsoTemplates;
  "migrations/syncKapsoTemplatesHelper": typeof migrations_syncKapsoTemplatesHelper;
  modelPricing: typeof modelPricing;
  orgKeys: typeof orgKeys;
  organizations: typeof organizations;
  payments: typeof payments;
  permissions: typeof permissions;
  providers: typeof providers;
  publicChat: typeof publicChat;
  rateLimits: typeof rateLimits;
  roles: typeof roles;
  sandboxSessions: typeof sandboxSessions;
  sync: typeof sync;
  threads: typeof threads;
  toolTesting: typeof toolTesting;
  "tools/agents": typeof tools_agents;
  "tools/airtable": typeof tools_airtable;
  "tools/calendar": typeof tools_calendar;
  "tools/email": typeof tools_email;
  "tools/entities": typeof tools_entities;
  "tools/events": typeof tools_events;
  "tools/flow": typeof tools_flow;
  "tools/helpers": typeof tools_helpers;
  "tools/index": typeof tools_index;
  "tools/web": typeof tools_web;
  "tools/whatsapp": typeof tools_whatsapp;
  triggers: typeof triggers;
  users: typeof users;
  whatsapp: typeof whatsapp;
  whatsappActions: typeof whatsappActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
