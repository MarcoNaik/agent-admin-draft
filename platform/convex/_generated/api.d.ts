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
import type * as entities from "../entities.js";
import type * as entityTypes from "../entityTypes.js";
import type * as evalRunner from "../evalRunner.js";
import type * as evals from "../evals.js";
import type * as events from "../events.js";
import type * as executions from "../executions.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_creditPricing from "../lib/creditPricing.js";
import type * as lib_integrations_flow from "../lib/integrations/flow.js";
import type * as lib_integrations_googleCalendar from "../lib/integrations/googleCalendar.js";
import type * as lib_integrations_whatsapp from "../lib/integrations/whatsapp.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_permissions_context from "../lib/permissions/context.js";
import type * as lib_permissions_evaluate from "../lib/permissions/evaluate.js";
import type * as lib_permissions_index from "../lib/permissions/index.js";
import type * as lib_permissions_mask from "../lib/permissions/mask.js";
import type * as lib_permissions_scope from "../lib/permissions/scope.js";
import type * as lib_permissions_tools from "../lib/permissions/tools.js";
import type * as lib_permissions_types from "../lib/permissions/types.js";
import type * as lib_scheduling from "../lib/scheduling.js";
import type * as lib_sync_agents from "../lib/sync/agents.js";
import type * as lib_sync_entityTypes from "../lib/sync/entityTypes.js";
import type * as lib_sync_evalSuites from "../lib/sync/evalSuites.js";
import type * as lib_sync_index from "../lib/sync/index.js";
import type * as lib_sync_roles from "../lib/sync/roles.js";
import type * as lib_sync_triggers from "../lib/sync/triggers.js";
import type * as lib_templateEngine from "../lib/templateEngine.js";
import type * as lib_triggers from "../lib/triggers.js";
import type * as lib_utils from "../lib/utils.js";
import type * as lib_workflows_session from "../lib/workflows/session.js";
import type * as migrations from "../migrations.js";
import type * as migrations_addEnvironment from "../migrations/addEnvironment.js";
import type * as organizations from "../organizations.js";
import type * as payments from "../payments.js";
import type * as permissions from "../permissions.js";
import type * as providers from "../providers.js";
import type * as publicChat from "../publicChat.js";
import type * as roles from "../roles.js";
import type * as sessions from "../sessions.js";
import type * as sync from "../sync.js";
import type * as threads from "../threads.js";
import type * as tools_agents from "../tools/agents.js";
import type * as tools_calendar from "../tools/calendar.js";
import type * as tools_entities from "../tools/entities.js";
import type * as tools_events from "../tools/events.js";
import type * as tools_helpers from "../tools/helpers.js";
import type * as tools_index from "../tools/index.js";
import type * as tools_whatsapp from "../tools/whatsapp.js";
import type * as triggers from "../triggers.js";
import type * as users from "../users.js";
import type * as whatsapp from "../whatsapp.js";

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
  entities: typeof entities;
  entityTypes: typeof entityTypes;
  evalRunner: typeof evalRunner;
  evals: typeof evals;
  events: typeof events;
  executions: typeof executions;
  http: typeof http;
  integrations: typeof integrations;
  "lib/auth": typeof lib_auth;
  "lib/creditPricing": typeof lib_creditPricing;
  "lib/integrations/flow": typeof lib_integrations_flow;
  "lib/integrations/googleCalendar": typeof lib_integrations_googleCalendar;
  "lib/integrations/whatsapp": typeof lib_integrations_whatsapp;
  "lib/llm": typeof lib_llm;
  "lib/permissions/context": typeof lib_permissions_context;
  "lib/permissions/evaluate": typeof lib_permissions_evaluate;
  "lib/permissions/index": typeof lib_permissions_index;
  "lib/permissions/mask": typeof lib_permissions_mask;
  "lib/permissions/scope": typeof lib_permissions_scope;
  "lib/permissions/tools": typeof lib_permissions_tools;
  "lib/permissions/types": typeof lib_permissions_types;
  "lib/scheduling": typeof lib_scheduling;
  "lib/sync/agents": typeof lib_sync_agents;
  "lib/sync/entityTypes": typeof lib_sync_entityTypes;
  "lib/sync/evalSuites": typeof lib_sync_evalSuites;
  "lib/sync/index": typeof lib_sync_index;
  "lib/sync/roles": typeof lib_sync_roles;
  "lib/sync/triggers": typeof lib_sync_triggers;
  "lib/templateEngine": typeof lib_templateEngine;
  "lib/triggers": typeof lib_triggers;
  "lib/utils": typeof lib_utils;
  "lib/workflows/session": typeof lib_workflows_session;
  migrations: typeof migrations;
  "migrations/addEnvironment": typeof migrations_addEnvironment;
  organizations: typeof organizations;
  payments: typeof payments;
  permissions: typeof permissions;
  providers: typeof providers;
  publicChat: typeof publicChat;
  roles: typeof roles;
  sessions: typeof sessions;
  sync: typeof sync;
  threads: typeof threads;
  "tools/agents": typeof tools_agents;
  "tools/calendar": typeof tools_calendar;
  "tools/entities": typeof tools_entities;
  "tools/events": typeof tools_events;
  "tools/helpers": typeof tools_helpers;
  "tools/index": typeof tools_index;
  "tools/whatsapp": typeof tools_whatsapp;
  triggers: typeof triggers;
  users: typeof users;
  whatsapp: typeof whatsapp;
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
