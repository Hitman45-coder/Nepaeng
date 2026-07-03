/**
 * Next.js instrumentation hook. Runs once when the server process boots.
 * We use it to start the node-cron MYOB payment-status poller, but only in the
 * Node.js runtime (never Edge).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMyobPoller } = await import("@/lib/cron");
    startMyobPoller();
  }
}
