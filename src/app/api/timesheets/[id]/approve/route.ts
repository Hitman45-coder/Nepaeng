import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approvalActionSchema } from "@/lib/validation";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";
import { validateApprovalAction } from "@/lib/approval-hierarchy";
import { sendTimesheetApprovedNotification } from "@/lib/notifications";

/**
 * POST /api/timesheets/:id/approve
 *
 * Approver approves a SUBMITTED timesheet. Once approved, the timesheet
 * becomes read-only (locked).
 *
 * Security:
 * - Uses full approval hierarchy validation (self-check, role-level, assignment)
 * - ADMINISTRATOR, SENIOR_ENGINEER can approve (subject to hierarchy)
 * - BOOKKEEPER can approve if canApprove flag is set
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    // Load the approver's canApprove flag
    const approverUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { canApprove: true },
    });

    const timesheet = await prisma.timesheetHeader.findUnique({
      where: { id: params.id },
      include: {
        employee: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!timesheet) throw new HttpError(404, "Timesheet not found");

    // Must be SUBMITTED
    if (timesheet.status !== "SUBMITTED") {
      throw new HttpError(
        400,
        `Cannot approve a timesheet with status: ${timesheet.status}`
      );
    }

    // Full hierarchy validation
    const validation = await validateApprovalAction({
      approverId: user.id,
      approverRole: user.role,
      approverCanApprove: approverUser?.canApprove ?? false,
      employeeId: timesheet.employeeId,
      employeeRole: timesheet.employee.role,
    });

    if (!validation.allowed) {
      throw new HttpError(403, validation.reason ?? "Approval not permitted");
    }

    const json = await req.json().catch(() => ({}));
    const parsed = approvalActionSchema.safeParse(json);
    const comment = parsed.success ? parsed.data.comment : null;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ??
      req.headers.get("x-real-ip") ??
      null;

    const updated = await prisma.$transaction(async (tx) => {
      const ts = await tx.timesheetHeader.update({
        where: { id: params.id },
        data: {
          status: "APPROVED",
          approvedDate: new Date(),
          approvedById: user.id,
          approvalComment: comment ?? null,
          modifiedBy: user.id,
          ipAddress: ip,
        },
      });

      await tx.approvalHistory.create({
        data: {
          timesheetId: params.id,
          status: "APPROVED",
          comment: comment ?? null,
          userId: user.id,
          ipAddress: ip,
        },
      });

      return ts;
    });

    // Notify employee (fire and forget)
    sendTimesheetApprovedNotification({
      timesheetId: updated.id,
      employeeId: timesheet.employeeId,
      employeeName: timesheet.employee.name,
      approverName: user.name,
      weekStart: timesheet.weekStart,
    }).catch(console.error);

    return NextResponse.json({ timesheet: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
