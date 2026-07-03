"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TimesheetStatus } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  FileSpreadsheet,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  formatWeekRange,
  getPreviousWeekStart,
  getNextWeekStart,
  toDateOnly,
} from "@/lib/timesheet-utils";
import { formatDate } from "@/lib/utils";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SUBMITTED: { label: "Submitted", variant: "warning" },
  NEEDS_REVISION: { label: "Needs Revision", variant: "destructive" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

interface TimesheetRow {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: TimesheetStatus;
  totalHours: number;
  submittedDate: string | null;
  approvedDate: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    team: string | null;
    position: string | null;
  };
  approvedBy: { id: string; name: string } | null;
}

export function PayrollDashboard({
  timesheets,
  weekStart,
  departments,
  totalApproved,
  totalHoursSum,
  filters,
}: {
  timesheets: TimesheetRow[];
  weekStart: string;
  departments: string[];
  totalApproved: number;
  totalHoursSum: number;
  filters: { status: string; department: string; search: string };
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

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("status", filters.status);
    params.set("week", toDateOnly(weekStartDate));
    if (filters.department) params.set("department", filters.department);
    window.open(`/api/timesheets/export-csv?${params.toString()}`, "_blank");
  }

  function downloadPdf(id: string) {
    window.open(`/api/timesheets/${id}/pdf`, "_blank");
  }

  return (
    <div>
      <PageHeader
        title="Payroll & Reports"
        description="Consolidated view of approved timesheets for payroll processing."
      />

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalApproved}</p>
              <p className="text-xs text-muted-foreground">Approved timesheets</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalHoursSum}</p>
              <p className="text-xs text-muted-foreground">Total hours this week</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{timesheets.length}</p>
              <p className="text-xs text-muted-foreground">Total records shown</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters bar */}
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

        <Select
          value={filters.status}
          onValueChange={(v) => navigate({ status: v })}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
          </SelectContent>
        </Select>

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

        <div className="flex items-center gap-1">
          <Input
            className="h-8 w-[160px]"
            placeholder="Search employee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && navigate({ search })}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate({ search })}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Export buttons */}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Main table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Week</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead>Approved Date</TableHead>
              <TableHead className="text-right">PDF</TableHead>
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
              const badge = STATUS_BADGES[ts.status] ?? STATUS_BADGES.DRAFT;
              return (
                <TableRow key={ts.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{ts.employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ts.employee.department ?? ""}
                        {ts.employee.team ? ` · ${ts.employee.team}` : ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(ts.weekStart)} – {formatDate(ts.weekEnd)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {ts.totalHours}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ts.approvedBy?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ts.approvedDate ? formatDate(ts.approvedDate) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadPdf(ts.id)}
                      title="Download PDF"
                    >
                      <FileDown className="h-4 w-4" />
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
