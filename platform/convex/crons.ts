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

export default crons
