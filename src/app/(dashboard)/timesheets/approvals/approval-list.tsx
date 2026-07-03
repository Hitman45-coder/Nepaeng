"use client";

import { useRouter } from "next/navigation";
import { TimesheetStatus, Role } from "@prisma/client";
import { ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { formatWeekRange, getPreviousWeekStart, getNextWeekStart, toDateOnly } from "@/lib/timesheet-utils";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import { useState } from "react";

const STATUS_BADGES: Record<TimesheetStatus, { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SUBMITTED: { label: "Submitted", variant: "warning" },
  NEEDS_REVISION: { label: "Needs Revision", variant: "destructive" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

interface EmployeeInfo {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  team: string | null;
  position: string | null;
  defaultApprover: { id: string; name: string } | null;
}

interface TimesheetRow {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: TimesheetStatus;
  totalHours: number;
  submittedDate: string | null;
  employee: EmployeeInfo;
  approvedBy: { id: string; name: string } | null;
}

export function ApprovalList({
  timesheets,
  weekStart,
  canApprove,
  departments,
  teams,
  filters,
}: {
  timesheets: TimesheetRow[];
  weekStart: string;
  canApprove: boolean;
  departments: string[];
  teams: string[];
  filters: { department: string; team: string; status: string; search: string };
}) {
  const router = useRouter();
  const weekStartDate = new Date(weekStart);

  const [search, setSearch] = useState(filters.search);

  function navigate(params: Record<string, string>) {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    router.push(url.pathname + url.search);
  }

  function navWeek(direction: "prev" | "next") {
    const target = direction === "prev"
      ? getPreviousWeekStart(weekStartDate)
      : getNextWeekStart(weekStartDate);
    navigate({ week: toDateOnly(target) });
  }

  function applySearch() {
    navigate({ search });
  }

  const pendingCount = timesheets.filter((t) => t.status === "SUBMITTED").length;

  return (
    <div>
      <PageHeader
        title="Timesheet Approvals"
        description={`${pendingCount} timesheet${pendingCount !== 1 ? "s" : ""} awaiting approval this week.`}
      />

      {/* Week navigation + filters bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Week nav */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{formatWeekRange(weekStartDate)}</span>
          <Button variant="outline" size="icon" onClick={() => navWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <Select
          value={filters.department || "ALL"}
          onValueChange={(v) => navigate({ department: v === "ALL" ? "" : v })}
        >
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.team || "ALL"}
          onValueChange={(v) => navigate({ team: v === "ALL" ? "" : v })}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Teams</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "ALL"}
          onValueChange={(v) => navigate({ status: v === "ALL" ? "" : v })}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="NEEDS_REVISION">Needs Revision</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="flex items-center gap-1">
          <Input
            className="h-8 w-[180px]"
            placeholder="Search employee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
          />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={applySearch}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Employee-centric table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Week Ending</TableHead>
              <TableHead className="text-right">Total Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timesheets.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No timesheets found for this week with the current filters.
                </TableCell>
              </TableRow>
            )}
            {timesheets.map((ts) => {
              const badge = STATUS_BADGES[ts.status];
              const isActionable = ts.status === "SUBMITTED" && canApprove;

              return (
                <TableRow key={ts.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell
                    onClick={() => router.push(`/timesheets/approvals/${ts.id}`)}
                  >
                    <div>
                      <p className="font-medium">{ts.employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ts.employee.position ?? ts.employee.role}
                        {ts.employee.department && ` · ${ts.employee.department}`}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell
                    onClick={() => router.push(`/timesheets/approvals/${ts.id}`)}
                  >
                    {formatDate(ts.weekEnd)}
                  </TableCell>
                  <TableCell
                    className="text-right font-medium"
                    onClick={() => router.push(`/timesheets/approvals/${ts.id}`)}
                  >
                    {ts.totalHours}
                  </TableCell>
                  <TableCell
                    onClick={() => router.push(`/timesheets/approvals/${ts.id}`)}
                  >
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    onClick={() => router.push(`/timesheets/approvals/${ts.id}`)}
                  >
                    {ts.submittedDate ? "Yes" : "No"}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    onClick={() => router.push(`/timesheets/approvals/${ts.id}`)}
                  >
                    {ts.employee.defaultApprover?.name ?? ts.approvedBy?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={isActionable ? "default" : "outline"}
                      size="sm"
                      onClick={() => router.push(`/timesheets/approvals/${ts.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                      {isActionable ? "Review" : "View"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
