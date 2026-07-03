import "server-only";
import { prisma } from "@/lib/prisma";
import type { TimesheetStatus } from "@prisma/client";

/**
 * Audit Trail Service
 *
 * Records every modification and status change to timesheets.
 * The ApprovalHistory table serves as the primary audit log per the spec.
 *
 * Additional audit logging (e.g., to an external service or structured log)
 * can be added here without touching the route handlers.
 */

export interface AuditEntry {
  timesheetId: string;
  status: TimesheetStatus;
  userId: string;
  comment?: string | null;
  ipAddress?: string | null;
}

/**
 * Record an audit trail entry in the ApprovalHistory table.
 * This is the canonical function used by all workflow transitions.
 */
export async function recordAuditEntry(entry: AuditEntry): Promise<void> {
  await prisma.approvalHistory.create({
    data: {
      timesheetId: entry.timesheetId,
      status: entry.status,
      comment: entry.comment ?? null,
      userId: entry.userId,
      ipAddress: entry.ipAddress ?? null,
    },
  });

  // Structured log output for external log aggregation (ELK, Datadog, etc.)
  console.log(
    JSON.stringify({
      event: "timesheet_audit",
      timesheetId: entry.timesheetId,
      status: entry.status,
      userId: entry.userId,
      comment: entry.comment ?? null,
      ipAddress: entry.ipAddress ?? null,
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Get the full audit trail for a timesheet, ordered newest first.
 */
export async function getAuditTrail(timesheetId: string) {
  return prisma.approvalHistory.findMany({
    where: { timesheetId },
    orderBy: { actionDate: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

/**
 * Extract the client IP address from request headers.
 * Works with common proxies (Nginx, Cloudflare, AWS ALB).
 */
export function extractIpAddress(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    null
  );
}
