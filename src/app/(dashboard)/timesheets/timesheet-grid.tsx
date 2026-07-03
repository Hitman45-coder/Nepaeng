"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityType, TimesheetStatus, Role } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  Send,
  Trash2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectSearchDropdown } from "./project-search";
import {
  TIMESHEET_CONSTANTS,
  SYSTEM_ACTIVITIES,
  type DayColumn,
} from "@/lib/validation";
import {
  formatWeekRange,
  getPreviousWeekStart,
  getNextWeekStart,
  toDateOnly,
} from "@/lib/timesheet-utils";
import { cn } from "@/lib/utils";

// ---- Types ----------------------------------------------------------------

interface ProjectRef {
  id: string;
  projectNumber: string;
  projectName: string;
}

interface LineData {
  id?: string;
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
  sortOrder: number;
}

interface TimesheetData {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: TimesheetStatus;
  totalHours: number;
  weeklyComment: string | null;
  submittedDate: string | null;
  approvedDate: string | null;
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

const DAYS = TIMESHEET_CONSTANTS.DAYS;
const DAY_LABELS = TIMESHEET_CONSTANTS.DAY_LABELS;

const STATUS_BADGES: Record<TimesheetStatus, { label: string; variant: "default" | "warning" | "success" | "destructive" | "secondary" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SUBMITTED: { label: "Submitted", variant: "warning" },
  NEEDS_REVISION: { label: "Needs Revision", variant: "destructive" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

// ---- Component ------------------------------------------------------------

export function TimesheetGrid({
  timesheet: initial,
  employeeName,
  role,
}: {
  timesheet: TimesheetData;
  employeeName: string;
  role: Role;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [lines, setLines] = useState<LineData[]>(initial.lines);
  const [status, setStatus] = useState<TimesheetStatus>(initial.status);
  const [weeklyComment, setWeeklyComment] = useState(initial.weeklyComment ?? "");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const lastSaved = useRef<string>(JSON.stringify({ lines: initial.lines, weeklyComment: initial.weeklyComment }));
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const isLocked = status === "SUBMITTED" || status === "APPROVED" || status === "CANCELLED";
  const isEditable = status === "DRAFT" || status === "REJECTED" || status === "NEEDS_REVISION";
  const canSubmit = (role === "ENGINEER" || role === "SENIOR_ENGINEER" || role === "ADMINISTRATOR") && isEditable;

  const weekStart = useMemo(() => new Date(initial.weekStart), [initial.weekStart]);

  // ---- Calculations -------------------------------------------------------

  const dailyTotals = useMemo(() => {
    const totals: Record<DayColumn, number> = {
      sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0,
    };
    for (const line of lines) {
      for (const day of DAYS) {
        totals[day] += line[day];
      }
    }
    // Round to avoid floating point
    for (const day of DAYS) {
      totals[day] = Math.round(totals[day] * 10) / 10;
    }
    return totals;
  }, [lines]);

  const weeklyTotal = useMemo(
    () => Object.values(dailyTotals).reduce((s, v) => s + v, 0),
    [dailyTotals]
  );

  const remaining = Math.max(0, TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS - weeklyTotal);
  const isOvertime = weeklyTotal > TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS;
  const isExact = weeklyTotal === TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS;

  // ---- Auto-save logic (every 30 seconds) ---------------------------------

  const doSave = useCallback(async () => {
    if (!isEditable || saving) return;
    const current = JSON.stringify({ lines, weeklyComment });
    if (current === lastSaved.current) return; // no changes

    setSaving(true);
    try {
      const payload = {
        weeklyComment: weeklyComment || null,
        lines: lines.map((l, idx) => ({
          id: l.id,
          projectId: l.activityType === "PROJECT" ? l.projectId : null,
          activityType: l.activityType,
          sunday: l.sunday,
          monday: l.monday,
          tuesday: l.tuesday,
          wednesday: l.wednesday,
          thursday: l.thursday,
          friday: l.friday,
          lineComment: l.lineComment || null,
          sortOrder: idx,
        })),
      };

      const res = await fetch(`/api/timesheets/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        lastSaved.current = current;
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Auto-save failed:", data.error);
      }
    } finally {
      setSaving(false);
    }
  }, [lines, weeklyComment, isEditable, saving, initial.id]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!isEditable) return;
    autoSaveTimer.current = setInterval(doSave, 30_000);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [doSave, isEditable]);

  // Save on unmount / tab close
  useEffect(() => {
    if (!isEditable) return;
    const handler = () => { doSave(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [doSave, isEditable]);

  // Save when lines change (debounced by the 30s timer; also save on specific triggers)
  function triggerSave() {
    if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(doSave, 2000) as unknown as NodeJS.Timeout;
  }

  // ---- Row operations -----------------------------------------------------

  function addProjectRow() {
    setLines((prev) => [
      ...prev,
      {
        projectId: null,
        project: null,
        activityType: "PROJECT",
        sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0,
        totalHours: 0,
        lineComment: null,
        sortOrder: prev.length,
      },
    ]);
  }

  function addActivityRow(type: ActivityType) {
    // Check if already exists
    if (lines.some((l) => l.activityType === type)) {
      toast({ title: "Already added", description: `${type} is already in the grid.`, variant: "error" });
      return;
    }
    const label = SYSTEM_ACTIVITIES.find((a) => a.type === type)?.label ?? type;
    setLines((prev) => [
      ...prev,
      {
        projectId: null,
        project: null,
        activityType: type,
        sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0,
        totalHours: 0,
        lineComment: null,
        sortOrder: prev.length,
      },
    ]);
    triggerSave();
  }

  function removeRow(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
    triggerSave();
  }

  function setProject(idx: number, project: ProjectRef) {
    // Check duplicate
    if (lines.some((l, i) => i !== idx && l.projectId === project.id && l.activityType === "PROJECT")) {
      toast({ title: "Duplicate", description: "This project is already in the grid.", variant: "error" });
      return;
    }
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, projectId: project.id, project } : l
      )
    );
    triggerSave();
  }

  function setHours(idx: number, day: DayColumn, value: number) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, [day]: value };
        updated.totalHours = DAYS.reduce((s, d) => s + updated[d], 0);
        return updated;
      })
    );
    triggerSave();
  }

  function setLineComment(idx: number, comment: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, lineComment: comment || null } : l))
    );
    triggerSave();
  }

  // ---- Copy previous week -------------------------------------------------

  async function copyPreviousWeek() {
    const prevWeek = getPreviousWeekStart(weekStart);
    const res = await fetch(
      `/api/timesheets/current?date=${toDateOnly(prevWeek)}`
    );
    if (!res.ok) {
      toast({ title: "Could not load previous week", variant: "error" });
      return;
    }
    const data = await res.json();
    const prevLines = data.timesheet?.lines ?? [];
    if (prevLines.length === 0) {
      toast({ title: "Previous week is empty", variant: "error" });
      return;
    }
    // Copy project/activity rows but zero out hours
    const copied: LineData[] = prevLines.map((l: any, idx: number) => ({
      projectId: l.projectId,
      project: l.project,
      activityType: l.activityType,
      sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0,
      totalHours: 0,
      lineComment: null,
      sortOrder: idx,
    }));
    setLines(copied);
    triggerSave();
    toast({ title: "Copied project rows from previous week", variant: "success" });
  }

  // ---- Submit for approval ------------------------------------------------

  async function submit() {
    if (!isExact) {
      toast({
        title: "Cannot submit",
        description: `Weekly hours must be exactly ${TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS}. Current: ${weeklyTotal}`,
        variant: "error",
      });
      return;
    }
    if (lines.length === 0) {
      toast({ title: "Cannot submit", description: "Add at least one row.", variant: "error" });
      return;
    }
    // Check all project rows have a project selected
    const emptyProject = lines.find((l) => l.activityType === "PROJECT" && !l.projectId);
    if (emptyProject) {
      toast({ title: "Cannot submit", description: "Select a project for all project rows.", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      // Save first
      await doSave();
      // Then submit
      const res = await fetch(`/api/timesheets/${initial.id}/submit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Submit failed", description: data.error, variant: "error" });
        return;
      }
      setStatus("SUBMITTED");
      toast({ title: "Timesheet submitted for approval", variant: "success" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Week navigation ----------------------------------------------------

  function navWeek(direction: "prev" | "next") {
    doSave(); // save current first
    const target = direction === "prev"
      ? getPreviousWeekStart(weekStart)
      : getNextWeekStart(weekStart);
    router.push(`/timesheets?date=${toDateOnly(target)}`);
  }

  // ---- Render -------------------------------------------------------------

  return (
    <div>
      {/* Top bar: week selector, employee, status, submit */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-semibold">{formatWeekRange(weekStart)}</h2>
            <p className="text-xs text-muted-foreground">{employeeName}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => navWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={STATUS_BADGES[status].variant}>
            {STATUS_BADGES[status].label}
          </Badge>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {canSubmit && (
            <Button
              onClick={submit}
              disabled={submitting || !isExact || lines.length === 0}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit for Approval
            </Button>
          )}
        </div>
      </div>

      {/* Rejection notice */}
      {status === "REJECTED" && initial.approvalHistory.length > 0 && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">Timesheet rejected</p>
          <p className="mt-1 text-sm text-red-700">
            {initial.approvalHistory[0]?.comment}
          </p>
          <p className="mt-1 text-xs text-red-600">
            By {initial.approvalHistory[0]?.userName} on{" "}
            {new Date(initial.approvalHistory[0]?.actionDate).toLocaleDateString("en-AU")}
          </p>
        </div>
      )}

      {/* Needs revision notice */}
      {status === "NEEDS_REVISION" && initial.approvalHistory.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">Changes requested</p>
          <p className="mt-1 text-sm text-amber-700">
            {initial.approvalHistory[0]?.comment}
          </p>
          <p className="mt-1 text-xs text-amber-600">
            By {initial.approvalHistory[0]?.userName} on{" "}
            {new Date(initial.approvalHistory[0]?.actionDate).toLocaleDateString("en-AU")}
          </p>
        </div>
      )}

      {/* Main grid */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground" style={{ minWidth: 240 }}>
                  Project / Activity
                </th>
                {DAY_LABELS.map((label, i) => (
                  <th
                    key={label}
                    className="w-[72px] px-2 py-2.5 text-center font-semibold text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
                <th className="w-[72px] px-2 py-2.5 text-center font-semibold">
                  Total
                </th>
                {isEditable && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/20">
                  {/* Project/Activity cell */}
                  <td className="px-3 py-1.5">
                    {line.activityType === "PROJECT" ? (
                      isEditable && !line.projectId ? (
                        <ProjectSearchDropdown
                          onSelect={(p) => setProject(idx, p)}
                          excludeIds={lines
                            .filter((l) => l.projectId && l.activityType === "PROJECT")
                            .map((l) => l.projectId!)}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          {isEditable && (
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                          )}
                          <div>
                            <span className="font-medium">
                              {line.project?.projectNumber}
                            </span>
                            <span className="ml-1.5 text-muted-foreground">
                              {line.project?.projectName}
                            </span>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        {isEditable && (
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                        <span className="font-medium text-muted-foreground">
                          {SYSTEM_ACTIVITIES.find((a) => a.type === line.activityType)?.label ?? line.activityType}
                        </span>
                      </div>
                    )}
                    {/* Per-row comment */}
                    {isEditable ? (
                      <input
                        type="text"
                        value={line.lineComment ?? ""}
                        onChange={(e) => setLineComment(idx, e.target.value)}
                        placeholder="Add comment…"
                        className="mt-1 w-full rounded border-0 bg-transparent px-0 text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0"
                      />
                    ) : (
                      line.lineComment && (
                        <p className="mt-0.5 text-xs italic text-muted-foreground">
                          {line.lineComment}
                        </p>
                      )
                    )}
                  </td>

                  {/* Hour cells */}
                  {DAYS.map((day) => (
                    <td key={day} className="px-1 py-1.5 text-center">
                      <HourCell
                        value={line[day]}
                        onChange={(v) => setHours(idx, day, v)}
                        disabled={!isEditable}
                      />
                    </td>
                  ))}

                  {/* Row total */}
                  <td className="px-2 py-1.5 text-center font-semibold">
                    {line.totalHours || lines.reduce
                      ? DAYS.reduce((s, d) => s + line[d], 0)
                      : 0}
                  </td>

                  {/* Remove */}
                  {isEditable && (
                    <td className="px-1 py-1.5 text-center">
                      <button
                        onClick={() => removeRow(idx)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {/* Daily totals row */}
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-3 py-2.5">Daily Total</td>
                {DAYS.map((day) => (
                  <td
                    key={day}
                    className={cn(
                      "px-2 py-2.5 text-center",
                      dailyTotals[day] > TIMESHEET_CONSTANTS.DAILY_MAX_HOURS &&
                        "text-destructive"
                    )}
                  >
                    {dailyTotals[day]}
                  </td>
                ))}
                <td
                  className={cn(
                    "px-2 py-2.5 text-center text-base",
                    isOvertime && "text-destructive",
                    isExact && "text-emerald-600"
                  )}
                >
                  {weeklyTotal}
                </td>
                {isEditable && <td />}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Bottom actions */}
      {isEditable && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={addProjectRow}>
            <Plus className="h-4 w-4" />
            Add Project
          </Button>

          {/* System activity dropdown */}
          <div className="relative">
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  addActivityRow(e.target.value as ActivityType);
                  e.target.value = "";
                }
              }}
            >
              <option value="">+ Add Activity…</option>
              {SYSTEM_ACTIVITIES.filter(
                (a) => !lines.some((l) => l.activityType === a.type)
              ).map((a) => (
                <option key={a.type} value={a.type}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={copyPreviousWeek}>
            <Copy className="h-4 w-4" />
            Copy Previous Week
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={doSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Draft
          </Button>
        </div>
      )}

      {/* Weekly comment */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Employee Weekly Comment</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditable ? (
            <textarea
              value={weeklyComment}
              onChange={(e) => {
                setWeeklyComment(e.target.value);
                triggerSave();
              }}
              placeholder="Add a weekly summary comment (visible to your approver)…"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : weeklyComment ? (
            <p className="text-sm text-muted-foreground">{weeklyComment}</p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">No weekly comment.</p>
          )}
        </CardContent>
      </Card>

      {/* Right side: Weekly Summary */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <SummaryRow
              label="Expected Hours"
              value={`${TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS}`}
            />
            <SummaryRow label="Entered Hours" value={`${weeklyTotal}`} />
            <SummaryRow
              label="Remaining"
              value={`${remaining}`}
              highlight={remaining > 0 ? "warning" : undefined}
            />
            {isOvertime && (
              <p className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                Weekly hours cannot exceed {TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS}.
              </p>
            )}
            <div className="border-t pt-2">
              <SummaryRow label="Status" value={STATUS_BADGES[status].label} />
            </div>
          </CardContent>
        </Card>

        {/* Approval history */}
        {initial.approvalHistory.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Approval History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {initial.approvalHistory.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 text-sm">
                    <Badge
                      variant={STATUS_BADGES[h.status]?.variant ?? "secondary"}
                      className="mt-0.5"
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---- Sub-components -------------------------------------------------------

function HourCell({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value || ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRaw(value ? String(value) : "");
  }, [value]);

  function commit() {
    setEditing(false);
    const num = parseFloat(raw) || 0;
    // Snap to 0.5 increments
    const snapped = Math.round(num * 2) / 2;
    const clamped = Math.max(0, Math.min(TIMESHEET_CONSTANTS.DAILY_MAX_HOURS, snapped));
    setRaw(clamped ? String(clamped) : "");
    if (clamped !== value) onChange(clamped);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === "Tab") {
      commit();
    }
    // Arrow key navigation
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(TIMESHEET_CONSTANTS.DAILY_MAX_HOURS, (value || 0) + 0.5);
      onChange(next);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(0, (value || 0) - 0.5);
      onChange(next);
    }
  }

  if (disabled) {
    return (
      <div className="flex h-8 w-full items-center justify-center rounded bg-muted/40 text-sm font-medium tabular-nums">
        {value || <span className="text-muted-foreground/50">—</span>}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={editing ? raw : value ? String(value) : ""}
      onFocus={() => {
        setEditing(true);
        setRaw(value ? String(value) : "");
      }}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-8 w-full rounded border border-transparent bg-transparent text-center text-sm tabular-nums outline-none transition-colors",
        "hover:border-input focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/30",
        value > 0 && "font-medium"
      )}
      placeholder="0"
    />
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "warning" | "error";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium",
          highlight === "warning" && "text-amber-600",
          highlight === "error" && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  );
}
