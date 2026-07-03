import { NextResponse } from "next/server";
import { Prisma, TimesheetStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveTimesheetSchema, validateWeeklyTotal } from "@/lib/validation";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";
import { hasTimesheetPermission } from "@/lib/rbac";
import { getWeekEnd } from "@/lib/timesheet-utils";

/**
 * GET /api/timesheets
 *
 * List timesheets (history view).
 * - ENGINEER: own timesheets only
 * - SENIOR_ENGINEER: own + team (employees assigned to them)
 * - ADMINISTRATOR: all timesheets (or filter by ?employeeId=)
 * - BOOKKEEPER: all timesheets (read-only)
 *
 * Query params: ?status=DRAFT&employeeId=xxx&department=xxx&team=xxx&week=YYYY-MM-DD
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") as TimesheetStatus | null;
    const employeeIdFilter = searchParams.get("employeeId");
    const departmentFilter = searchParams.get("department");
    const teamFilter = searchParams.get("team");
    const weekFilter = searchParams.get("week");

    const where: Prisma.TimesheetHeaderWhereInput = {};

    // Role-based visibility
    if (user.role === "ENGINEER") {
      // Engineers see only their own
      where.employeeId = user.id;
    } else if (user.role === "SENIOR_ENGINEER") {
      // Senior Engineers see own + employees assigned to them
      if (employeeIdFilter) {
        where.employeeId = employeeIdFilter;
      } else {
        where.OR = [
          { employeeId: user.id },
          { employee: { defaultApproverId: user.id } },
          { employee: { backupApproverId: user.id } },
          { employee: { managerId: user.id } },
        ];
      }
    } else if (employeeIdFilter) {
      // ADMIN/BOOKKEEPER with explicit filter
      where.employeeId = employeeIdFilter;
    }

    // Status filter
    if (statusFilter && Object.values(TimesheetStatus).includes(statusFilter)) {
      where.status = statusFilter;
    }

    // Department/team filters (through employee relation)
    if (departmentFilter || teamFilter) {
      where.employee = {
        ...(where.employee as Prisma.UserWhereInput ?? {}),
        ...(departmentFilter ? { department: departmentFilter } : {}),
        ...(teamFilter ? { team: teamFilter } : {}),
      };
    }

    // Week filter
    if (weekFilter) {
      const weekDate = new Date(weekFilter);
      weekDate.setHours(0, 0, 0, 0);
      where.weekStart = weekDate;
    }

    const timesheets = await prisma.timesheetHeader.findMany({
      where,
      orderBy: { weekStart: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            team: true,
            position: true,
            role: true,
            defaultApprover: { select: { id: true, name: true } },
          },
        },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      take: 104, // ~2 years of weeks
    });

    return NextResponse.json({ timesheets });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/timesheets
 *
 * Create a new timesheet (initial save/draft). If one already exists for the
 * specified week, returns 409.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    if (!hasTimesheetPermission(user.role, "createTimesheet")) {
      throw new HttpError(403, "Your role cannot create timesheets");
    }

    const json = await req.json();
    const parsed = saveTimesheetSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input"
      );
    }

    const { weekStart, lines } = parsed.data;
    const weeklyComment = (json as Record<string, unknown>).weeklyComment as string | undefined;
    const weekStartDate = new Date(weekStart);
    weekStartDate.setHours(0, 0, 0, 0);
    const weekEnd = getWeekEnd(weekStartDate);

    // Check for existing timesheet this week
    const existing = await prisma.timesheetHeader.findUnique({
      where: {
        employeeId_weekStart: {
          employeeId: user.id,
          weekStart: weekStartDate,
        },
      },
    });
    if (existing) {
      throw new HttpError(
        409,
        "A timesheet already exists for this week. Use PUT to update it."
      );
    }

    // Validate weekly total
    const { total, isValid } = validateWeeklyTotal(lines);
    if (!isValid) {
      throw new HttpError(400, "Weekly hours cannot exceed the maximum allowed");
    }

    // Validate projects exist and are active
    for (const line of lines) {
      if (line.activityType === "PROJECT" && line.projectId) {
        const project = await prisma.project.findUnique({
          where: { id: line.projectId },
          select: { id: true },
        });
        if (!project) {
          throw new HttpError(404, `Project ${line.projectId} not found`);
        }
      }
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ??
      req.headers.get("x-real-ip") ??
      null;

    const timesheet = await prisma.timesheetHeader.create({
      data: {
        employeeId: user.id,
        weekStart: weekStartDate,
        weekEnd,
        status: "DRAFT",
        totalHours: total,
        weeklyComment: weeklyComment ?? null,
        createdBy: user.id,
        modifiedBy: user.id,
        ipAddress: ip,
        lines: {
          create: lines.map((line, idx) => ({
            projectId: line.activityType === "PROJECT" ? line.projectId : null,
            activityType: line.activityType,
            sunday: line.sunday ?? 0,
            monday: line.monday ?? 0,
            tuesday: line.tuesday ?? 0,
            wednesday: line.wednesday ?? 0,
            thursday: line.thursday ?? 0,
            friday: line.friday ?? 0,
            totalHours:
              (line.sunday ?? 0) +
              (line.monday ?? 0) +
              (line.tuesday ?? 0) +
              (line.wednesday ?? 0) +
              (line.thursday ?? 0) +
              (line.friday ?? 0),
            lineComment: (line as unknown as { lineComment?: string }).lineComment ?? null,
            sortOrder: line.sortOrder ?? idx,
          })),
        },
      },
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
          include: {
            project: {
              select: { id: true, projectNumber: true, projectName: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ timesheet }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
