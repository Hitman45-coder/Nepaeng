import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTimesheetSchema, validateWeeklyTotal } from "@/lib/validation";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";
import { hasTimesheetPermission } from "@/lib/rbac";

/**
 * GET /api/timesheets/:id
 *
 * Retrieve a single timesheet with all lines (including lineComment),
 * employee profile details, approval history, and relations.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    const timesheet = await prisma.timesheetHeader.findUnique({
      where: { id: params.id },
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
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
            defaultApprover: { select: { id: true, name: true } },
            backupApprover: { select: { id: true, name: true } },
          },
        },
        approvedBy: { select: { id: true, name: true } },
        approvalHistory: {
          orderBy: { actionDate: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!timesheet) throw new HttpError(404, "Timesheet not found");

    // Engineers can only view their own timesheets
    if (user.role === "ENGINEER" && timesheet.employeeId !== user.id) {
      throw new HttpError(403, "You can only view your own timesheets");
    }

    // Senior Engineers can view own + their assigned employees
    if (user.role === "SENIOR_ENGINEER" && timesheet.employeeId !== user.id) {
      const employee = await prisma.user.findUnique({
        where: { id: timesheet.employeeId },
        select: { defaultApproverId: true, backupApproverId: true, managerId: true },
      });
      const isAssigned =
        employee?.defaultApproverId === user.id ||
        employee?.backupApproverId === user.id ||
        employee?.managerId === user.id;
      if (!isAssigned) {
        throw new HttpError(403, "You can only view timesheets of employees assigned to you");
      }
    }

    return NextResponse.json({ timesheet });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PUT /api/timesheets/:id
 *
 * Update/auto-save a DRAFT, REJECTED, or NEEDS_REVISION timesheet.
 * Replaces all lines. Cannot modify SUBMITTED, APPROVED, or CANCELLED.
 *
 * Accepts optional `weeklyComment` in body alongside `lines`.
 */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    if (!hasTimesheetPermission(user.role, "editDraft")) {
      throw new HttpError(403, "Your role cannot edit timesheets");
    }

    const existing = await prisma.timesheetHeader.findUnique({
      where: { id: params.id },
      select: { id: true, employeeId: true, status: true },
    });
    if (!existing) throw new HttpError(404, "Timesheet not found");

    // Only the owner can edit their timesheet (ADMIN can edit any)
    if (existing.employeeId !== user.id && user.role !== "ADMINISTRATOR") {
      throw new HttpError(403, "You can only edit your own timesheets");
    }

    // Can only edit DRAFT, REJECTED, or NEEDS_REVISION timesheets
    const editableStatuses = ["DRAFT", "REJECTED", "NEEDS_REVISION"];
    if (!editableStatuses.includes(existing.status)) {
      throw new HttpError(
        400,
        `Cannot edit a timesheet with status: ${existing.status}`
      );
    }

    const json = await req.json();
    const parsed = updateTimesheetSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input"
      );
    }

    const { lines } = parsed.data;
    const weeklyComment = (json as Record<string, unknown>).weeklyComment as string | undefined;

    // Validate weekly total
    const { total, isValid } = validateWeeklyTotal(lines);
    if (!isValid) {
      throw new HttpError(400, "Weekly hours cannot exceed the maximum allowed");
    }

    // Validate projects exist
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

    // Replace all lines in a transaction
    const timesheet = await prisma.$transaction(async (tx) => {
      await tx.timesheetLine.deleteMany({
        where: { timesheetId: params.id },
      });

      // Editing a REJECTED or NEEDS_REVISION timesheet returns it to DRAFT
      const newStatus =
        existing.status === "REJECTED" || existing.status === "NEEDS_REVISION"
          ? "DRAFT"
          : existing.status;

      return tx.timesheetHeader.update({
        where: { id: params.id },
        data: {
          totalHours: total,
          modifiedBy: user.id,
          ipAddress: ip,
          status: newStatus,
          ...(weeklyComment !== undefined ? { weeklyComment } : {}),
          lines: {
            create: lines.map((line, idx) => ({
              projectId:
                line.activityType === "PROJECT" ? line.projectId : null,
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
    });

    return NextResponse.json({ timesheet });
  } catch (err) {
    return errorResponse(err);
  }
}
