import { cronJobs, makeFunctionReference } from "convex/server"

const checkIdleSessionsRef = makeFunctionReference<"mutation">("sandboxSessions:checkIdleSessions")
const reconcilePaymentsRef = makeFunctionReference<"action">("payments:reconcilePayments")
const reconcileBalancesRef = makeFunctionReference<"mutation">("billing:reconcileBalances")

const cleanupOldMessagesRef = makeFunctionReference<"mutation">("lib/cleanup:cleanupOldMessages")
const cleanupOldExecutionsRef = makeFunctionReference<"mutation">("lib/cleanup:cleanupOldExecutions")
const cleanupOldEventsRef = makeFunctionReference<"mutation">("lib/cleanup:cleanupOldEvents")
const cleanupStuckRunsRef = makeFunctionReference<"mutation">("evals:cleanupStuckRuns")
const cleanupOldTransactionsRef = makeFunctionReference<"mutation">("lib/cleanup:cleanupOldTransactions")
const compactOldExecutionsRef = makeFunctionReference<"mutation">("lib/cleanup:compactOldExecutions")
const syncModelPricingRef = makeFunctionReference<"action">("modelPricing:syncPricing")
const syncModelRegistryRef = makeFunctionReference<"action">("modelPricing:syncModelRegistry")
const syncAllOrgKeysRef = makeFunctionReference<"action">("orgKeys:syncAllOrgKeys")
const cleanupOrphanedUserRolesRef = makeFunctionReference<"mutation">("roles:cleanupOrphanedUserRoles")
const checkLowBalancesRef = makeFunctionReference<"mutation">("billing:checkLowBalances")
const resetWeeklyCreditsRef = makeFunctionReference<"mutation">("billing:resetWeeklyCredits")

const crons = cronJobs()

crons.interval(
  "cleanup idle sandbox sessions",
  { seconds: 60 },
  checkIdleSessionsRef,
)

crons.interval(
  "reconcile pending payments",
  { minutes: 5 },
  reconcilePaymentsRef,
)


crons.interval(
  "reconcile credit balances",
  { hours: 1 },
  reconcileBalancesRef,
)

crons.interval(
  "cleanup old messages",
  { hours: 6 },
  cleanupOldMessagesRef,
)

crons.interval(
  "cleanup old executions",
  { hours: 12 },
  cleanupOldExecutionsRef,
)

crons.interval(
  "cleanup old events",
  { hours: 24 },
  cleanupOldEventsRef,
)

crons.interval(
  "cleanup stuck eval runs",
  { minutes: 5 },
  cleanupStuckRunsRef,
)

crons.interval(
  "cleanup old credit transactions",
  { hours: 24 },
  cleanupOldTransactionsRef,
)

crons.interval(
  "compact old executions",
  { hours: 12 },
  compactOldExecutionsRef,
)

crons.interval(
  "sync model pricing from OpenRouter",
  { hours: 24 },
  syncModelPricingRef,
)

crons.interval(
  "sync model registry from OpenRouter",
  { hours: 24 },
  syncModelRegistryRef,
)

crons.interval(
  "sync org OpenRouter key usage",
  { minutes: 15 },
  syncAllOrgKeysRef,
)

crons.interval(
  "cleanup orphaned and expired user roles",
  { hours: 24 },
  cleanupOrphanedUserRolesRef,
)

crons.interval(
  "check low credit balances",
  { hours: 24 },
  checkLowBalancesRef,
)

crons.interval(
  "reset weekly credits safety net",
  { hours: 24 },
  resetWeeklyCreditsRef,
)

export default crons
