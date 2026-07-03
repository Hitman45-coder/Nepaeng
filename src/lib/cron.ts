import "server-only";
import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { getInvoiceStatus, getValidSettings } from "@/lib/myob";

/**
 * Poll MYOB for the payment status of every invoiced-but-unpaid project and
 * flip `isPaid` once MYOB reports the invoice as settled.
 *
 * Started once from `src/instrumentation.ts` when MYOB_POLL_ENABLED=true.
 */

// Guard against double-scheduling across hot reloads / multiple imports.
const globalForCron = globalThis as unknown as {
  myobPollTask?: cron.ScheduledTask;
  myobPolling?: boolean;
};

export async function pollMyobPayments(): Promise<{
  checked: number;
  updated: number;
}> {
  if (globalForCron.myobPolling) return { checked: 0, updated: 0 };
  globalForCron.myobPolling = true;
  let checked = 0;
  let updated = 0;
  try {
    const settings = await getValidSettings();
    if (!settings) {
      console.warn("[myob-poll] skipped — MYOB not connected");
      return { checked: 0, updated: 0 };
    }

    const projects = await prisma.project.findMany({
      where: { isInvoiced: true, isPaid: false, myobInvoiceUid: { not: null } },
      select: { id: true, myobInvoiceUid: true, projectNumber: true },
    });

    for (const p of projects) {
      checked++;
      try {
        const status = await getInvoiceStatus(p.myobInvoiceUid as string);
        if (status.isPaid) {
          await prisma.project.update({
            where: { id: p.id },
            data: { isPaid: true },
          });
          updated++;
          console.log(`[myob-poll] ${p.projectNumber} marked PAID`);
        }
      } catch (err) {
        console.error(`[myob-poll] failed for ${p.projectNumber}:`, err);
      }
    }
    return { checked, updated };
  } finally {
    globalForCron.myobPolling = false;
  }
}

export function startMyobPoller(): void {
  if (process.env.MYOB_POLL_ENABLED !== "true") {
    console.log("[myob-poll] disabled (set MYOB_POLL_ENABLED=true to enable)");
    return;
  }
  if (globalForCron.myobPollTask) return; // already scheduled

  const expr = process.env.MYOB_POLL_CRON ?? "*/15 * * * *";
  if (!cron.validate(expr)) {
    console.error(`[myob-poll] invalid cron expression: ${expr}`);
    return;
  }

  globalForCron.myobPollTask = cron.schedule(expr, () => {
    pollMyobPayments()
      .then(({ checked, updated }) =>
        console.log(`[myob-poll] checked ${checked}, updated ${updated}`)
      )
      .catch((err) => console.error("[myob-poll] run error:", err));
  });

  console.log(`[myob-poll] scheduled with cron "${expr}"`);
}
