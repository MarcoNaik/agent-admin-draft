import { cronJobs, makeFunctionReference } from "convex/server"

const checkIdleSessionsRef = makeFunctionReference<"mutation">("sandboxSessions:checkIdleSessions")
const reconcilePaymentsRef = makeFunctionReference<"action">("payments:reconcilePayments")
const reconcileBalancesRef = makeFunctionReference<"mutation">("billing:reconcileBalances")

const cleanupOldMessagesRef = makeFunctionReference<"mutation">("lib/cleanup:cleanupOldMessages")
const cleanupOldExecutionsRef = makeFunctionReference<"mutation">("lib/cleanup:cleanupOldExecutions")
const cleanupOldEventsRef = makeFunctionReference<"mutation">("lib/cleanup:cleanupOldEvents")
const cleanupStuckRunsRef = makeFunctionReference<"mutation">("evals:cleanupStuckRuns")

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

export default crons
