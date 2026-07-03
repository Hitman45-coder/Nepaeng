export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";
import { canRead } from "@/lib/rbac";
import { decToNum } from "@/lib/serialize";
import { SYSTEM_ACTIVITIES, TIMESHEET_CONSTANTS } from "@/lib/validation";

/**
 * GET /api/timesheets/export-csv?status=APPROVED&week=YYYY-MM-DD&department=xxx
 *
 * Export timesheet data as CSV for payroll processing.
 * Only accessible by BOOKKEEPER and ADMINISTRATOR (timesheetPayroll resource).
 *
 * Columns: Employee, Email, Department, Team, Week Start, Week End, Status,
 *          Total Hours, Project/Activity, Sun, Mon, Tue, Wed, Thu, Fri, Line Total, Comment
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();

    if (!canRead(user.role, "timesheetPayroll")) {
      throw new HttpError(403, "You do not have access to payroll exports");
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") ?? "APPROVED";
    const weekFilter = searchParams.get("week");
    const departmentFilter = searchParams.get("department");
    const employeeFilter = searchParams.get("employeeId");

    const where: Prisma.TimesheetHeaderWhereInput = {};

    if (statusFilter && statusFilter !== "ALL") {
      where.status = statusFilter as any;
    }
    if (weekFilter) {
      where.weekStart = new Date(weekFilter);
    }
    if (departmentFilter) {
      where.employee = { department: departmentFilter };
    }
    if (employeeFilter) {
      where.employeeId = employeeFilter;
    }

    const timesheets = await prisma.timesheetHeader.findMany({
      where,
      orderBy: [{ employee: { name: "asc" } }, { weekStart: "desc" }],
      include: {
        employee: {
          select: { name: true, email: true, department: true, team: true },
        },
        approvedBy: { select: { name: true } },
        lines: {
          orderBy: { sortOrder: "asc" },
          include: {
            project: { select: { projectNumber: true, projectName: true } },
          },
        },
      },
      take: 500,
    });

    // Build CSV
    const DAYS = TIMESHEET_CONSTANTS.DAYS;
    const headers = [
      "Employee",
      "Email",
      "Department",
      "Team",
      "Week Start",
      "Week End",
      "Status",
      "Total Hours",
      "Approved By",
      "Project/Activity",
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Line Total",
      "Comment",
    ];

    const rows: string[][] = [];

    for (const ts of timesheets) {
      for (const line of ts.lines) {
        const activityLabel =
          line.activityType === "PROJECT"
            ? `${line.project?.projectNumber ?? ""} - ${line.project?.projectName ?? ""}`
            : (SYSTEM_ACTIVITIES.find((a) => a.type === line.activityType)?.label ?? line.activityType);

        rows.push([
          ts.employee.name,
          ts.employee.email,
          ts.employee.department ?? "",
          ts.employee.team ?? "",
          ts.weekStart.toISOString().slice(0, 10),
          ts.weekEnd.toISOString().slice(0, 10),
          ts.status,
          String(decToNum(ts.totalHours) ?? 0),
          ts.approvedBy?.name ?? "",
          activityLabel,
          String(decToNum(line.sunday) ?? 0),
          String(decToNum(line.monday) ?? 0),
          String(decToNum(line.tuesday) ?? 0),
          String(decToNum(line.wednesday) ?? 0),
          String(decToNum(line.thursday) ?? 0),
          String(decToNum(line.friday) ?? 0),
          String(decToNum(line.totalHours) ?? 0),
          (line.lineComment ?? "").replace(/"/g, '""'),
        ]);
      }
    }

    // Escape CSV values
    function escapeCSV(val: string): string {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    const filename = `Timesheets_Payroll_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
