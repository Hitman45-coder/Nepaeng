import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead } from "@/lib/rbac";
import { decToNum } from "@/lib/serialize";
import { ApprovalDetail } from "./approval-detail";

export const dynamic = "force-dynamic";

export default async function TimesheetApprovalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canRead(session.role, "timesheetApprovals")) redirect("/403");

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

  if (!timesheet) notFound();

  // Determine if the current user can take approval actions
  const approverUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { canApprove: true },
  });
  const canAct =
    timesheet.status === "SUBMITTED" &&
    (session.role === "ADMINISTRATOR" ||
      session.role === "SENIOR_ENGINEER" ||
      (session.role === "BOOKKEEPER" && approverUser?.canApprove));

  const serialized = {
    id: timesheet.id,
    weekStart: timesheet.weekStart.toISOString(),
    weekEnd: timesheet.weekEnd.toISOString(),
    status: timesheet.status,
    totalHours: decToNum(timesheet.totalHours) ?? 0,
    weeklyComment: timesheet.weeklyComment,
    approvalComment: timesheet.approvalComment,
    submittedDate: timesheet.submittedDate?.toISOString() ?? null,
    approvedDate: timesheet.approvedDate?.toISOString() ?? null,
    employee: timesheet.employee,
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
      lineComment: l.lineComment,
    })),
    approvalHistory: timesheet.approvalHistory.map((h) => ({
      id: h.id,
      status: h.status,
      comment: h.comment,
      userName: h.user.name,
      actionDate: h.actionDate.toISOString(),
    })),
  };

  return <ApprovalDetail timesheet={serialized} canAct={!!canAct} />;
}
