"use client";

import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import { Loader2, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS } from "@/lib/rbac";

interface ApproverOption {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
}

interface TimesheetSettings {
  department: string | null;
  team: string | null;
  position: string | null;
  timesheetEnabled: boolean;
  canApprove: boolean;
  canExportPdf: boolean;
  canUnlockApproved: boolean;
  maxWeeklyHours: number;
  expectedDailyHours: number;
  defaultApprover: { id: string; name: string; email: string } | null;
  backupApprover: { id: string; name: string; email: string } | null;
}

export function TimesheetSettingsDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approvers, setApprovers] = useState<ApproverOption[]>([]);

  // Form state
  const [department, setDepartment] = useState("");
  const [team, setTeam] = useState("");
  const [position, setPosition] = useState("");
  const [defaultApproverId, setDefaultApproverId] = useState<string>("");
  const [backupApproverId, setBackupApproverId] = useState<string>("");
  const [timesheetEnabled, setTimesheetEnabled] = useState(true);
  const [canApprove, setCanApprove] = useState(false);
  const [canExportPdf, setCanExportPdf] = useState(false);
  const [canUnlockApproved, setCanUnlockApproved] = useState(false);
  const [maxWeeklyHours, setMaxWeeklyHours] = useState("42");
  const [expectedDailyHours, setExpectedDailyHours] = useState("7");

  // Load settings and approvers when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/users/${userId}/timesheet-settings`).then((r) => r.json()),
      fetch(`/api/users/approvers?exclude=${userId}`).then((r) => r.json()),
    ])
      .then(([settingsData, approversData]) => {
        const s = settingsData.settings as TimesheetSettings;
        setDepartment(s.department ?? "");
        setTeam(s.team ?? "");
        setPosition(s.position ?? "");
        setDefaultApproverId(s.defaultApprover?.id ?? "");
        setBackupApproverId(s.backupApprover?.id ?? "");
        setTimesheetEnabled(s.timesheetEnabled);
        setCanApprove(s.canApprove);
        setCanExportPdf(s.canExportPdf);
        setCanUnlockApproved(s.canUnlockApproved);
        setMaxWeeklyHours(String(s.maxWeeklyHours));
        setExpectedDailyHours(String(s.expectedDailyHours));
        setApprovers(approversData.approvers ?? []);
      })
      .catch(() => {
        toast({ title: "Failed to load settings", variant: "error" });
      })
      .finally(() => setLoading(false));
  }, [open, userId, toast]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}/timesheet-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: department || null,
          team: team || null,
          position: position || null,
          defaultApproverId: defaultApproverId || null,
          backupApproverId: backupApproverId || null,
          timesheetEnabled,
          canApprove,
          canExportPdf,
          canUnlockApproved,
          maxWeeklyHours: Number(maxWeeklyHours),
          expectedDailyHours: Number(expectedDailyHours),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Save failed",
          description: data.error,
          variant: "error",
        });
        return;
      }
      toast({ title: "Timesheet settings saved", variant: "success" });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Timesheet Settings
          </DialogTitle>
          <DialogDescription>
            Configure timesheet settings for <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {/* Organisation */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Organisation
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ts-dept">Department</Label>
                  <Input
                    id="ts-dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ts-team">Team</Label>
                  <Input
                    id="ts-team"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="e.g. Fire & Hydraulics"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ts-position">Position</Label>
                <Input
                  id="ts-position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Project Engineer"
                />
              </div>
            </section>

            {/* Approval Assignment */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Approval Assignment
              </h4>
              <div className="space-y-1.5">
                <Label>Default Approver</Label>
                <Select
                  value={defaultApproverId || "none"}
                  onValueChange={(v) =>
                    setDefaultApproverId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an approver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No approver —</SelectItem>
                    {approvers.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({ROLE_LABELS[a.role]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Secondary (Backup) Approver</Label>
                <Select
                  value={backupApproverId || "none"}
                  onValueChange={(v) =>
                    setBackupApproverId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select backup approver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No backup —</SelectItem>
                    {approvers
                      .filter((a) => a.id !== defaultApproverId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({ROLE_LABELS[a.role]})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Permissions */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permissions
              </h4>
              <div className="space-y-2">
                <ToggleRow
                  label="Timesheet Enabled"
                  description="User can fill and submit timesheets"
                  checked={timesheetEnabled}
                  onChange={setTimesheetEnabled}
                />
                <ToggleRow
                  label="Can Approve Timesheets"
                  description="User can approve/reject team timesheets"
                  checked={canApprove}
                  onChange={setCanApprove}
                />
                <ToggleRow
                  label="Can Export PDF"
                  description="User can download timesheet PDFs"
                  checked={canExportPdf}
                  onChange={setCanExportPdf}
                />
                <ToggleRow
                  label="Can Unlock Approved"
                  description="User can unlock approved timesheets (HR Admin)"
                  checked={canUnlockApproved}
                  onChange={setCanUnlockApproved}
                />
              </div>
            </section>

            {/* Hours Configuration */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hours
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ts-max">Maximum Weekly Hours</Label>
                  <Input
                    id="ts-max"
                    type="number"
                    min="0"
                    max="168"
                    step="0.5"
                    value={maxWeeklyHours}
                    onChange={(e) => setMaxWeeklyHours(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ts-daily">Expected Daily Hours</Label>
                  <Input
                    id="ts-daily"
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={expectedDailyHours}
                    onChange={(e) => setExpectedDailyHours(e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-input"
      />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}
