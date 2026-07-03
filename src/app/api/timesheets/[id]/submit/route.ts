import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TIMESHEET_CONSTANTS,
  validateWeeklyTotal,
  type TimesheetLineInput,
} from "@/lib/validation";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";
import { hasTimesheetPermission } from "@/lib/rbac";
import { resolveApprover } from "@/lib/approval-hierarchy";
import { sendTimesheetSubmittedNotification } from "@/lib/notifications";

/**
 * POST /api/timesheets/:id/submit
 *
 * Submit a DRAFT or NEEDS_REVISION timesheet for approver review.
 *
 * Business rules:
 *  - Must be DRAFT or NEEDS_REVISION status
 *  - Weekly total must be exactly 42 hours (or the user's maxWeeklyHours)
 *  - Cannot submit an incomplete timesheet (must have at least 1 line)
 *  - Employee must have an assigned approver
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    if (!hasTimesheetPermission(user.role, "submit")) {
      throw new HttpError(403, "Your role cannot submit timesheets");
    }

    const timesheet = await prisma.timesheetHeader.findUnique({
      where: { id: params.id },
      include: {
        lines: true,
        employee: {
          select: {
            id: true,
            name: true,
            maxWeeklyHours: true,
            defaultApproverId: true,
            backupApproverId: true,
            managerId: true,
          },
        },
      },
    });

    if (!timesheet) throw new HttpError(404, "Timesheet not found");

    // Only the owner can submit
    if (timesheet.employeeId !== user.id) {
      throw new HttpError(403, "You can only submit your own timesheets");
    }

    // Must be DRAFT or NEEDS_REVISION
    if (timesheet.status !== "DRAFT" && timesheet.status !== "NEEDS_REVISION") {
      throw new HttpError(
        400,
        `Cannot submit a timesheet with status: ${timesheet.status}`
      );
    }

    // Must have at least 1 line
    if (timesheet.lines.length === 0) {
      throw new HttpError(400, "Cannot submit an empty timesheet");
    }

    // Validate weekly total = exactly the required hours
    const requiredHours = Number(timesheet.employee.maxWeeklyHours) || TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS;

    const lines: TimesheetLineInput[] = timesheet.lines.map((l) => ({
      activityType: l.activityType,
      projectId: l.projectId,
      sunday: Number(l.sunday),
      monday: Number(l.monday),
      tuesday: Number(l.tuesday),
      wednesday: Number(l.wednesday),
      thursday: Number(l.thursday),
      friday: Number(l.friday),
      sortOrder: l.sortOrder,
    }));

    const { total } = validateWeeklyTotal(lines);
    if (total !== requiredHours) {
      throw new HttpError(
        400,
        `Weekly hours must be exactly ${requiredHours}. Current: ${total}`
      );
    }

    // Resolve the assigned approver
    const approver = await resolveApprover(user.id);
    if (!approver) {
      throw new HttpError(
        400,
        "No approver is assigned to your account. Contact your administrator."
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ??
      req.headers.get("x-real-ip") ??
      null;

    // Update status and record in approval history
    const updated = await prisma.$transaction(async (tx) => {
      const ts = await tx.timesheetHeader.update({
        where: { id: params.id },
        data: {
          status: "SUBMITTED",
          submittedDate: new Date(),
          modifiedBy: user.id,
          ipAddress: ip,
        },
      });

      await tx.approvalHistory.create({
        data: {
          timesheetId: params.id,
          status: "SUBMITTED",
          comment: null,
          userId: user.id,
          ipAddress: ip,
        },
      });

      return ts;
    });

    // Send notification to assigned approver (fire and forget)
    sendTimesheetSubmittedNotification({
      timesheetId: updated.id,
      employeeName: timesheet.employee.name,
      managerId: approver.id,
      weekStart: timesheet.weekStart,
    }).catch(console.error);

    return NextResponse.json({ timesheet: updated, approver: { id: approver.id, name: approver.name } });
  } catch (err) {
    return errorResponse(err);
  }
}
