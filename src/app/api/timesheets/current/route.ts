export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, requireUser } from "@/lib/api-auth";
import { hasTimesheetPermission } from "@/lib/rbac";
import { getWeekStart, getWeekEnd } from "@/lib/timesheet-utils";

/**
 * GET /api/timesheets/current?date=YYYY-MM-DD
 *
 * Returns the timesheet for the current user for the week containing the
 * given date (defaults to today). If no timesheet exists yet for that week,
 * creates a DRAFT one (only for roles that can create timesheets).
 *
 * Includes: lines with lineComment, weeklyComment, employee profile,
 * approver info, and approval history.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const refDate = dateParam ? new Date(dateParam) : new Date();

    const weekStart = getWeekStart(refDate);
    const weekEnd = getWeekEnd(weekStart);

    const includeOptions = {
      lines: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          project: {
            select: { id: true, projectNumber: true, projectName: true },
          },
        },
      },
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          team: true,
          position: true,
          maxWeeklyHours: true,
          expectedDailyHours: true,
          defaultApprover: { select: { id: true, name: true } },
        },
      },
      approvedBy: { select: { id: true, name: true } },
      approvalHistory: {
        orderBy: { actionDate: "desc" as const },
        include: { user: { select: { id: true, name: true } } },
      },
    };

    // Try to find existing timesheet for this week
    let timesheet = await prisma.timesheetHeader.findUnique({
      where: {
        employeeId_weekStart: {
          employeeId: user.id,
          weekStart,
        },
      },
      include: includeOptions,
    });

    // Auto-create a draft if none exists (only for roles that can create)
    if (!timesheet && hasTimesheetPermission(user.role, "createTimesheet")) {
      timesheet = await prisma.timesheetHeader.create({
        data: {
          employeeId: user.id,
          weekStart,
          weekEnd,
          status: "DRAFT",
          totalHours: 0,
          createdBy: user.id,
          modifiedBy: user.id,
        },
        include: includeOptions,
      });
    }

    if (!timesheet) {
      return NextResponse.json({ timesheet: null });
    }

    return NextResponse.json({ timesheet });
  } catch (err) {
    return errorResponse(err);
  }
}
