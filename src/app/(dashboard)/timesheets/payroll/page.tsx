import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead } from "@/lib/rbac";
import { decToNum } from "@/lib/serialize";
import { getWeekStart, getWeekEnd } from "@/lib/timesheet-utils";
import { PayrollDashboard } from "./payroll-dashboard";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: {
    week?: string;
    department?: string;
    status?: string;
    search?: string;
  };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canRead(session.role, "timesheetPayroll")) redirect("/403");

  // Default: show current week, APPROVED status
  const refDate = searchParams.week ? new Date(searchParams.week) : new Date();
  const weekStart = getWeekStart(refDate);
  const statusFilter = searchParams.status ?? "APPROVED";

  // Build query
  const where: Record<string, unknown> = {
    weekStart,
  };
  if (statusFilter !== "ALL") {
    where.status = statusFilter;
  }
  if (searchParams.department) {
    where.employee = { department: searchParams.department };
  }
  if (searchParams.search) {
    where.employee = {
      ...(where.employee as Record<string, unknown> ?? {}),
      name: { contains: searchParams.search, mode: "insensitive" },
    };
  }

  const timesheets = await prisma.timesheetHeader.findMany({
    where: where as any,
    orderBy: [{ employee: { name: "asc" } }],
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          team: true,
          position: true,
        },
      },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  // Get distinct departments for filter
  const allDepartments = await prisma.user.findMany({
    where: { isActive: true, department: { not: null } },
    select: { department: true },
    distinct: ["department"],
  });
  const departments = allDepartments
    .map((d) => d.department)
    .filter(Boolean) as string[];

  // Summary stats
  const totalApproved = timesheets.filter((t) => t.status === "APPROVED").length;
  const totalHoursSum = timesheets.reduce(
    (sum, t) => sum + (decToNum(t.totalHours) ?? 0),
    0
  );

  const serialized = timesheets.map((ts) => ({
    id: ts.id,
    weekStart: ts.weekStart.toISOString(),
    weekEnd: ts.weekEnd.toISOString(),
    status: ts.status,
    totalHours: decToNum(ts.totalHours) ?? 0,
    submittedDate: ts.submittedDate?.toISOString() ?? null,
    approvedDate: ts.approvedDate?.toISOString() ?? null,
    employee: ts.employee,
    approvedBy: ts.approvedBy,
  }));

  return (
    <PayrollDashboard
      timesheets={serialized}
      weekStart={weekStart.toISOString()}
      departments={departments}
      totalApproved={totalApproved}
      totalHoursSum={Math.round(totalHoursSum * 10) / 10}
      filters={{
        status: statusFilter,
        department: searchParams.department ?? "",
        search: searchParams.search ?? "",
      }}
    />
  );
}
