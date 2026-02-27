import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
  "cleanup idle sandbox sessions",
  { seconds: 60 },
  internal.sandboxSessions.checkIdleSessions,
)

crons.interval(
  "reconcile pending payments",
  { minutes: 5 },
  internal.payments.reconcilePayments,
)

crons.interval(
  "reconcile credit balances",
  { seconds: 5 },
  internal.billing.reconcileBalances,
)

export default crons
