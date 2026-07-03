import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead } from "@/lib/rbac";
import { hasTimesheetPermission } from "@/lib/rbac";
import { getApprovableEmployees } from "@/lib/approval-hierarchy";
import { decToNum } from "@/lib/serialize";
import { getWeekStart, getWeekEnd } from "@/lib/timesheet-utils";
import { ApprovalList } from "./approval-list";

export const dynamic = "force-dynamic";

export default async function TimesheetApprovalsPage({
  searchParams,
}: {
  searchParams: {
    department?: string;
    team?: string;
    status?: string;
    search?: string;
    week?: string;
  };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canRead(session.role, "timesheetApprovals")) redirect("/403");

  // Determine the week to show (defaults to current)
  const refDate = searchParams.week ? new Date(searchParams.week) : new Date();
  const weekStart = getWeekStart(refDate);
  const weekEnd = getWeekEnd(weekStart);

  // Get the approver's canApprove flag
  const approverUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { canApprove: true },
  });
  const canApprove = approverUser?.canApprove ?? false;

  // Get all employees this user can view/approve
  const employees = await getApprovableEmployees(session.id, session.role);
  const employeeIds = employees.map((e) => e.id);

  // Build filter conditions
  type WhereInput = Parameters<typeof prisma.timesheetHeader.findMany>[0] extends { where?: infer W } ? W : never;
  const where: Record<string, unknown> = {
    weekStart,
    employeeId: { in: employeeIds },
  };

  if (searchParams.status && searchParams.status !== "ALL") {
    where.status = searchParams.status;
  }
  if (searchParams.department || searchParams.team || searchParams.search) {
    const employeeFilter: Record<string, unknown> = {};
    if (searchParams.department) employeeFilter.department = searchParams.department;
    if (searchParams.team) employeeFilter.team = searchParams.team;
    if (searchParams.search) {
      employeeFilter.OR = [
        { name: { contains: searchParams.search, mode: "insensitive" } },
        { email: { contains: searchParams.search, mode: "insensitive" } },
      ];
    }
    where.employee = employeeFilter;
  }

  // Fetch timesheets for the target week
  const timesheets = await prisma.timesheetHeader.findMany({
    where: where as any,
    orderBy: [{ employee: { name: "asc" } }],
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
      approvedBy: { select: { id: true, name: true } },
    },
  });

  // Get distinct departments and teams for filter dropdowns
  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))] as string[];
  const teams = [...new Set(employees.map((e) => e.team).filter(Boolean))] as string[];

  // Serialize
  const serialized = timesheets.map((ts) => ({
    id: ts.id,
    weekStart: ts.weekStart.toISOString(),
    weekEnd: ts.weekEnd.toISOString(),
    status: ts.status,
    totalHours: decToNum(ts.totalHours) ?? 0,
    submittedDate: ts.submittedDate?.toISOString() ?? null,
    employee: ts.employee,
    approvedBy: ts.approvedBy,
  }));

  return (
    <ApprovalList
      timesheets={serialized}
      weekStart={weekStart.toISOString()}
      canApprove={canApprove || session.role === "ADMINISTRATOR" || session.role === "SENIOR_ENGINEER"}
      departments={departments}
      teams={teams}
      filters={{
        department: searchParams.department ?? "",
        team: searchParams.team ?? "",
        status: searchParams.status ?? "ALL",
        search: searchParams.search ?? "",
      }}
    />
  );
}
