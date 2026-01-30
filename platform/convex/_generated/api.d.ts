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
import type * as entities from "../entities.js";
import type * as entityTypes from "../entityTypes.js";
import type * as events from "../events.js";
import type * as executions from "../executions.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_utils from "../lib/utils.js";
import type * as organizations from "../organizations.js";
import type * as packs from "../packs.js";
import type * as packs_index from "../packs/index.js";
import type * as packs_tutoring from "../packs/tutoring.js";
import type * as roles from "../roles.js";
import type * as threads from "../threads.js";
import type * as tools_entities from "../tools/entities.js";
import type * as tools_events from "../tools/events.js";
import type * as tools_helpers from "../tools/helpers.js";
import type * as tools_index from "../tools/index.js";
import type * as tools_jobs from "../tools/jobs.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agents: typeof agents;
  apiKeys: typeof apiKeys;
  entities: typeof entities;
  entityTypes: typeof entityTypes;
  events: typeof events;
  executions: typeof executions;
  http: typeof http;
  jobs: typeof jobs;
  "lib/auth": typeof lib_auth;
  "lib/utils": typeof lib_utils;
  organizations: typeof organizations;
  packs: typeof packs;
  "packs/index": typeof packs_index;
  "packs/tutoring": typeof packs_tutoring;
  roles: typeof roles;
  threads: typeof threads;
  "tools/entities": typeof tools_entities;
  "tools/events": typeof tools_events;
  "tools/helpers": typeof tools_helpers;
  "tools/index": typeof tools_index;
  "tools/jobs": typeof tools_jobs;
  users: typeof users;
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
