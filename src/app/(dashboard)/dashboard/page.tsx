import Link from "next/link";
import {
  FolderKanban,
  Handshake,
  Receipt,
  Clock,
  CircleDollarSign,
  AlertCircle,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead } from "@/lib/rbac";
import { decToNum } from "@/lib/serialize";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  icon: typeof FolderKanban;
  href?: string;
}) {
  const body = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;
  const { role } = session;

  const showFinancials = canRead(role, "financials");
  const showProposals = canRead(role, "proposals");

  const [
    projectCount,
    issuedOutCount,
    proposalPending,
    invoicedUnpaid,
    myHoursAgg,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { isIssuedOut: true } }),
    showProposals
      ? prisma.proposal.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
    showFinancials
      ? prisma.project.findMany({
          where: { isInvoiced: true, isPaid: false },
          select: { approvedFee: true },
        })
      : Promise.resolve([] as { approvedFee: unknown }[]),
    role === "ENGINEER"
      ? prisma.timesheet.aggregate({
          where: { userId: session.id },
          _sum: { hours: true },
        })
      : Promise.resolve({ _sum: { hours: null } }),
  ]);

  const outstanding = (invoicedUnpaid as { approvedFee: unknown }[]).reduce(
    (sum, p) => sum + (decToNum(p.approvedFee as never) ?? 0),
    0
  );

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session.name.split(" ")[0]}`}
        description="Here's a snapshot of the practice."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Active projects"
          value={String(projectCount)}
          icon={FolderKanban}
          href="/projects"
        />
        <Stat
          label="Issued for construction"
          value={String(issuedOutCount)}
          icon={Receipt}
          href="/projects"
        />

        {showProposals && (
          <Stat
            label="Pending proposals"
            value={String(proposalPending)}
            icon={Handshake}
            href="/proposals"
          />
        )}

        {showFinancials && (
          <Stat
            label="Outstanding (invoiced, unpaid)"
            value={formatCurrency(outstanding)}
            icon={CircleDollarSign}
            href="/projects"
          />
        )}

        {role === "ENGINEER" && (
          <Stat
            label="My logged hours"
            value={`${decToNum(myHoursAgg._sum.hours as never) ?? 0} h`}
            icon={Clock}
            href="/timesheets"
          />
        )}
      </div>

      <div className="mt-6 rounded-lg border bg-card p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Your access level</p>
            <p className="mt-1">
              {role === "ADMINISTRATOR" &&
                "Full access to proposals, financials, project delivery, and user management."}
              {role === "ENGINEER" &&
                "You can manage project scope, Gantt scheduling and comments, and log your own timesheets. Financials and the CRM are not available to your role."}
              {role === "BOOKKEEPER" &&
                "You can manage project financials and MYOB invoicing, and view project delivery and timesheets in read-only mode."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
