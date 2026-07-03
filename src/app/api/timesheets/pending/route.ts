export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";
import { hasTimesheetPermission } from "@/lib/rbac";
import { getApprovableEmployees } from "@/lib/approval-hierarchy";

/**
 * GET /api/timesheets/pending
 *
 * Employee-centric approval dashboard data.
 * Returns all SUBMITTED timesheets that the current user can approve,
 * organized by employee with full profile details.
 *
 * Query params: ?department=xxx&team=xxx&search=xxx
 *
 * Security: Only users with viewTeam + approveTeam permissions.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();

    if (!hasTimesheetPermission(user.role, "viewTeam")) {
      throw new HttpError(403, "You do not have access to the approval queue");
    }

    // For Bookkeepers without canApprove, they can view but not act
    const approverUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { canApprove: true },
    });

    const { searchParams } = new URL(req.url);
    const departmentFilter = searchParams.get("department");
    const teamFilter = searchParams.get("team");
    const searchQuery = searchParams.get("search");

    // Get employees this user can approve
    const approvableEmployees = await getApprovableEmployees(user.id, user.role);
    const employeeIds = approvableEmployees.map((e) => e.id);

    // If the user has no one to approve, return empty
    if (employeeIds.length === 0) {
      return NextResponse.json({ timesheets: [], canApprove: approverUser?.canApprove ?? false });
    }

    const where: Prisma.TimesheetHeaderWhereInput = {
      status: "SUBMITTED",
      employeeId: { in: employeeIds },
    };

    // Apply filters
    if (departmentFilter || teamFilter || searchQuery) {
      where.employee = {};
      if (departmentFilter) where.employee.department = departmentFilter;
      if (teamFilter) where.employee.team = teamFilter;
      if (searchQuery) {
        where.employee.OR = [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { email: { contains: searchQuery, mode: "insensitive" } },
        ];
      }
    }

    const timesheets = await prisma.timesheetHeader.findMany({
      where,
      orderBy: [{ submittedDate: "asc" }],
      include: {
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
          },
        },
        lines: {
          orderBy: { sortOrder: "asc" },
          include: {
            project: {
              select: { id: true, projectNumber: true, projectName: true },
            },
          },
        },
        approvalHistory: {
          orderBy: { actionDate: "desc" },
          take: 5,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json({
      timesheets,
      canApprove: approverUser?.canApprove ?? false,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
