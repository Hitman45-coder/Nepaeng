import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rejectActionSchema } from "@/lib/validation";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";
import { validateApprovalAction } from "@/lib/approval-hierarchy";
import { sendTimesheetRejectedNotification } from "@/lib/notifications";

/**
 * POST /api/timesheets/:id/reject
 *
 * Approver rejects a SUBMITTED timesheet. The timesheet status changes to
 * REJECTED so the employee can edit and resubmit.
 *
 * A comment is required when rejecting.
 *
 * Security: Uses full approval hierarchy validation.
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
        `Cannot reject a timesheet with status: ${timesheet.status}`
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
      throw new HttpError(403, validation.reason ?? "Rejection not permitted");
    }

    const json = await req.json();
    const parsed = rejectActionSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "A comment is required when rejecting"
      );
    }
    const { comment } = parsed.data;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ??
      req.headers.get("x-real-ip") ??
      null;

    const updated = await prisma.$transaction(async (tx) => {
      const ts = await tx.timesheetHeader.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          modifiedBy: user.id,
          ipAddress: ip,
        },
      });

      await tx.approvalHistory.create({
        data: {
          timesheetId: params.id,
          status: "REJECTED",
          comment,
          userId: user.id,
          ipAddress: ip,
        },
      });

      return ts;
    });

    // Notify employee with rejection comment (fire and forget)
    sendTimesheetRejectedNotification({
      timesheetId: updated.id,
      employeeId: timesheet.employeeId,
      employeeName: timesheet.employee.name,
      rejecterName: user.name,
      comment,
      weekStart: timesheet.weekStart,
    }).catch(console.error);

    return NextResponse.json({ timesheet: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
