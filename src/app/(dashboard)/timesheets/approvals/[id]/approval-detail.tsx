"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ActivityType, TimesheetStatus, Role } from "@prisma/client";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileDown,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { SYSTEM_ACTIVITIES, TIMESHEET_CONSTANTS } from "@/lib/validation";
import { formatWeekRange } from "@/lib/timesheet-utils";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const DAYS = TIMESHEET_CONSTANTS.DAYS;
const DAY_LABELS = TIMESHEET_CONSTANTS.DAY_LABELS;

const STATUS_BADGES: Record<TimesheetStatus, { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SUBMITTED: { label: "Submitted", variant: "warning" },
  NEEDS_REVISION: { label: "Needs Revision", variant: "destructive" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

interface ProjectRef {
  id: string;
  projectNumber: string;
  projectName: string;
}

interface LineData {
  id: string;
  projectId: string | null;
  project: ProjectRef | null;
  activityType: ActivityType;
  sunday: number;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  totalHours: number;
  lineComment: string | null;
}

interface EmployeeInfo {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  team: string | null;
  position: string | null;
  defaultApprover: { id: string; name: string } | null;
  backupApprover: { id: string; name: string } | null;
}

interface TimesheetData {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: TimesheetStatus;
  totalHours: number;
  weeklyComment: string | null;
  approvalComment: string | null;
  submittedDate: string | null;
  approvedDate: string | null;
  employee: EmployeeInfo;
  approvedBy: { id: string; name: string } | null;
  lines: LineData[];
  approvalHistory: Array<{
    id: string;
    status: TimesheetStatus;
    comment: string | null;
    userName: string;
    actionDate: string;
  }>;
}

export function ApprovalDetail({
  timesheet,
  canAct,
}: {
  timesheet: TimesheetData;
  canAct: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [comment, setComment] = useState("");
  const [approveComment, setApproveComment] = useState("");

  const weekStart = new Date(timesheet.weekStart);

  // Calculate daily totals
  const dailyTotals = DAYS.map((day) =>
    timesheet.lines.reduce((sum, l) => sum + l[day], 0)
  );
  const commentsCount = timesheet.lines.filter((l) => l.lineComment).length +
    (timesheet.weeklyComment ? 1 : 0);
  const projectCount = timesheet.lines.filter((l) => l.activityType === "PROJECT").length;

  async function doAction(action: "approve" | "reject" | "request-changes") {
    setBusyAction(action);
    try {
      const endpoint = action === "request-changes"
        ? `/api/timesheets/${timesheet.id}/request-changes`
        : `/api/timesheets/${timesheet.id}/${action}`;

      const body: Record<string, unknown> = {};
      if (action === "approve") body.comment = approveComment || null;
      if (action === "reject" || action === "request-changes") body.comment = comment;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Action failed", description: data.error, variant: "error" });
        return;
      }
      const labels = { approve: "Approved", reject: "Rejected", "request-changes": "Revision requested" };
      toast({ title: labels[action], variant: "success" });
      router.push("/timesheets/approvals");
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div>
      <Link
        href="/timesheets/approvals"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Approvals
      </Link>

      {/* Employee header */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{timesheet.employee.name}</h2>
            <Badge variant={STATUS_BADGES[timesheet.status].variant}>
              {STATUS_BADGES[timesheet.status].label}
            </Badge>
            {timesheet.status === "APPROVED" && (
              <Lock className="h-4 w-4 text-muted-foreground" title="Locked" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {timesheet.employee.department && (
              <span>Department: <span className="text-foreground">{timesheet.employee.department}</span></span>
            )}
            {timesheet.employee.position && (
              <span>Position: <span className="text-foreground">{timesheet.employee.position}</span></span>
            )}
            <span>Week: <span className="text-foreground">{formatWeekRange(weekStart)}</span></span>
            {timesheet.employee.defaultApprover && (
              <span>Approver: <span className="text-foreground">{timesheet.employee.defaultApprover.name}</span></span>
            )}
          </div>
        </div>

        {/* Summary panel (right side) */}
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected Hours</span>
              <span className="font-medium">{TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entered Hours</span>
              <span className="font-medium">{timesheet.totalHours}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-medium">
                {Math.max(0, TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS - timesheet.totalHours)}
              </span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projects</span>
                <span className="font-medium">{projectCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Comments</span>
                <span className="font-medium">{commentsCount}</span>
              </div>
            </div>
            {timesheet.submittedDate && (
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="font-medium">{formatDate(timesheet.submittedDate)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly timesheet grid (read-only) */}
      <Card className="mb-4">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground" style={{ minWidth: 260 }}>
                  Project / Activity
                </th>
                {DAY_LABELS.map((label) => (
                  <th key={label} className="w-[64px] px-2 py-2.5 text-center font-semibold text-muted-foreground">
                    {label}
                  </th>
                ))}
                <th className="w-[64px] px-2 py-2.5 text-center font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {timesheet.lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="px-3 py-2">
                    <div>
                      {line.activityType === "PROJECT" ? (
                        <div>
                          <span className="font-medium text-primary">{line.project?.projectNumber}</span>
                          <span className="ml-1.5">{line.project?.projectName}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-muted-foreground">
                          {SYSTEM_ACTIVITIES.find((a) => a.type === line.activityType)?.label ?? line.activityType}
                        </span>
                      )}
                      {line.lineComment && (
                        <p className="mt-0.5 text-xs italic text-muted-foreground">
                          &ldquo;{line.lineComment}&rdquo;
                        </p>
                      )}
                    </div>
                  </td>
                  {DAYS.map((day) => (
                    <td key={day} className="px-2 py-2 text-center tabular-nums">
                      {line[day] || <span className="text-muted-foreground/40">—</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center font-semibold tabular-nums">
                    {line.totalHours}
                  </td>
                </tr>
              ))}
              {/* Daily totals */}
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-3 py-2.5">Daily Total</td>
                {dailyTotals.map((t, i) => (
                  <td key={i} className="px-2 py-2.5 text-center">{Math.round(t * 10) / 10}</td>
                ))}
                <td className="px-2 py-2.5 text-center text-base">{timesheet.totalHours}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Comments section */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Employee weekly comment */}
        {timesheet.weeklyComment && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Employee Weekly Comment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{timesheet.weeklyComment}</p>
            </CardContent>
          </Card>
        )}

        {/* Approval history */}
        {timesheet.approvalHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Approval History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {timesheet.approvalHistory.map((h) => (
                <div key={h.id} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={STATUS_BADGES[h.status]?.variant ?? "secondary"}
                    className="mt-0.5 shrink-0"
                  >
                    {h.status}
                  </Badge>
                  <div>
                    <span className="font-medium">{h.userName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(h.actionDate).toLocaleString("en-AU")}
                    </span>
                    {h.comment && (
                      <p className="mt-0.5 text-muted-foreground">{h.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action area */}
      {canAct && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm">Approval Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Approve with optional comment */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Approval Comment (optional)
              </Label>
              <Textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="Optional comment when approving…"
                rows={2}
              />
            </div>

            {/* Reject/Request Changes comment */}
            {(showRejectForm || showRequestForm) && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
                <Label className="text-sm text-red-800">
                  {showRejectForm ? "Rejection comment (required)" : "What changes are needed? (required)"}
                </Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    showRejectForm
                      ? "Explain why the timesheet is being rejected…"
                      : "Describe what changes are needed…"
                  }
                  className="border-red-200 bg-white"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => doAction(showRejectForm ? "reject" : "request-changes")}
                    disabled={!!busyAction || !comment.trim()}
                  >
                    {busyAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    {showRejectForm ? "Confirm Reject" : "Confirm Request Changes"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowRejectForm(false);
                      setShowRequestForm(false);
                      setComment("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Main action buttons */}
            {!showRejectForm && !showRequestForm && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  onClick={() => doAction("approve")}
                  disabled={!!busyAction}
                >
                  {busyAction === "approve" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectForm(true)}
                  disabled={!!busyAction}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRequestForm(true)}
                  disabled={!!busyAction}
                >
                  <MessageSquare className="h-4 w-4" />
                  Request Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/api/timesheets/${timesheet.id}/pdf`, "_blank")}
                >
                  <FileDown className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* View-only actions (when not actionable) */}
      {!canAct && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/api/timesheets/${timesheet.id}/pdf`, "_blank")}
          >
            <FileDown className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      )}
    </div>
  );
}
