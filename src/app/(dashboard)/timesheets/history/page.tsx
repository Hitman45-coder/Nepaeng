import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead } from "@/lib/rbac";
import { decToNum } from "@/lib/serialize";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "warning" | "success" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

export default async function TimesheetHistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canRead(session.role, "timesheets")) redirect("/403");

  const isEngineer = session.role === "ENGINEER";

  const timesheets = await prisma.timesheetHeader.findMany({
    where: isEngineer ? { employeeId: session.id } : {},
    orderBy: { weekStart: "desc" },
    include: {
      employee: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    take: 52,
  });

  return (
    <div>
      <PageHeader
        title="Timesheet History"
        description={
          isEngineer
            ? "Your submitted and approved timesheets."
            : "All team timesheets across the practice."
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {!isEngineer && <TableHead>Employee</TableHead>}
              <TableHead>Week</TableHead>
              <TableHead className="text-right">Total Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Approved By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timesheets.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isEngineer ? 5 : 6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No timesheets found.
                </TableCell>
              </TableRow>
            )}
            {timesheets.map((ts) => (
              <TableRow key={ts.id}>
                {!isEngineer && (
                  <TableCell className="font-medium">
                    {ts.employee.name}
                  </TableCell>
                )}
                <TableCell>
                  <Link
                    href={`/timesheets?date=${ts.weekStart.toISOString().slice(0, 10)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {formatDate(ts.weekStart)} – {formatDate(ts.weekEnd)}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {decToNum(ts.totalHours) ?? 0}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[ts.status] ?? "secondary"}>
                    {ts.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {ts.submittedDate ? formatDate(ts.submittedDate) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {ts.approvedBy?.name ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
