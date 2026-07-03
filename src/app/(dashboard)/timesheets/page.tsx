import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead } from "@/lib/rbac";
import { getWeekStart, getWeekEnd } from "@/lib/timesheet-utils";
import { decToNum } from "@/lib/serialize";
import { TimesheetGrid } from "./timesheet-grid";

export const dynamic = "force-dynamic";

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canRead(session.role, "timesheets")) redirect("/403");

  // Determine the week to display
  const refDate = searchParams.date ? new Date(searchParams.date) : new Date();
  const weekStart = getWeekStart(refDate);
  const weekEnd = getWeekEnd(weekStart);

  // Fetch or auto-create the timesheet for this week
  let timesheet = await prisma.timesheetHeader.findUnique({
    where: {
      employeeId_weekStart: {
        employeeId: session.id,
        weekStart,
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
      approvedBy: { select: { id: true, name: true } },
      approvalHistory: {
        orderBy: { actionDate: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  // Auto-create a DRAFT if none exists (engineers only)
  if (!timesheet && session.role === "ENGINEER") {
    timesheet = await prisma.timesheetHeader.create({
      data: {
        employeeId: session.id,
        weekStart,
        weekEnd,
        status: "DRAFT",
        totalHours: 0,
        createdBy: session.id,
        modifiedBy: session.id,
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
        approvedBy: { select: { id: true, name: true } },
        approvalHistory: {
          orderBy: { actionDate: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
  }

  // For non-engineers viewing the page (admin/bookkeeper), show history link instead
  if (!timesheet) {
    redirect("/timesheets/history");
  }

  // Serialize for client
  const serializedTimesheet = {
    id: timesheet.id,
    weekStart: timesheet.weekStart.toISOString(),
    weekEnd: timesheet.weekEnd.toISOString(),
    status: timesheet.status,
    totalHours: decToNum(timesheet.totalHours) ?? 0,
    weeklyComment: timesheet.weeklyComment ?? null,
    submittedDate: timesheet.submittedDate?.toISOString() ?? null,
    approvedDate: timesheet.approvedDate?.toISOString() ?? null,
    approvedBy: timesheet.approvedBy,
    lines: timesheet.lines.map((l) => ({
      id: l.id,
      projectId: l.projectId,
      project: l.project,
      activityType: l.activityType,
      sunday: decToNum(l.sunday) ?? 0,
      monday: decToNum(l.monday) ?? 0,
      tuesday: decToNum(l.tuesday) ?? 0,
      wednesday: decToNum(l.wednesday) ?? 0,
      thursday: decToNum(l.thursday) ?? 0,
      friday: decToNum(l.friday) ?? 0,
      totalHours: decToNum(l.totalHours) ?? 0,
      lineComment: l.lineComment ?? null,
      sortOrder: l.sortOrder,
    })),
    approvalHistory: timesheet.approvalHistory.map((h) => ({
      id: h.id,
      status: h.status,
      comment: h.comment,
      userName: h.user.name,
      actionDate: h.actionDate.toISOString(),
    })),
  };

  return (
    <TimesheetGrid
      timesheet={serializedTimesheet}
      employeeName={session.name}
      role={session.role}
    />
  );
}
