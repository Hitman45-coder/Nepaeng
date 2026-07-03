"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Discipline } from "@prisma/client";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/shared/page-header";
import { DisciplineBadges } from "@/components/shared/discipline-badges";
import { DisciplinePicker } from "@/components/shared/discipline-picker";
import { cn, formatCurrency } from "@/lib/utils";

interface ProjectRow {
  id: string;
  projectNumber: string;
  projectName: string;
  clientName: string;
  scopeOfWork: Discipline[];
  assignedEngineers: { id: string; name: string }[];
  isIssuedOut: boolean;
  approvedFee: number;
  isInvoiced: boolean;
  isPaid: boolean;
}

export function ProjectsClient({
  initialProjects,
  showFinancials,
  canCreate,
  engineers,
}: {
  initialProjects: ProjectRow[];
  showFinancials: boolean;
  canCreate: boolean;
  engineers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [approvedFee, setApprovedFee] = useState("");
  const [scope, setScope] = useState<Discipline[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleEngineer(id: string) {
    setAssigned((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (scope.length === 0) {
      toast({ title: "Select at least one discipline", variant: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          clientDetails: { name: clientName, email: clientEmail },
          approvedFee,
          scopeOfWork: scope,
          assignedEngineerIds: assigned,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Create failed", description: data.error, variant: "error" });
        return;
      }
      setOpen(false);
      toast({ title: "Project created", variant: "success" });
      router.push(`/projects/${data.project.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Delivery projects across all disciplines."
        action={
          canCreate ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              New project
            </Button>
          ) : undefined
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Status</TableHead>
              {/* Financial columns are omitted from the DOM for roles without
                  financial read access (ENGINEER). */}
              {showFinancials && (
                <>
                  <TableHead className="text-right">Approved fee</TableHead>
                  <TableHead>Invoice</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialProjects.length === 0 && (
              <TableRow>
                <TableCell colSpan={showFinancials ? 7 : 5} className="py-10 text-center text-muted-foreground">
                  No projects yet.
                </TableCell>
              </TableRow>
            )}
            {initialProjects.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${p.id}`)}
              >
                <TableCell>
                  <div className="font-medium">{p.projectName}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.projectNumber}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{p.clientName || "—"}</TableCell>
                <TableCell>
                  <DisciplineBadges disciplines={p.scopeOfWork} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.assignedEngineers.length
                    ? p.assignedEngineers.map((e) => e.name).join(", ")
                    : "Unassigned"}
                </TableCell>
                <TableCell>
                  <Badge variant={p.isIssuedOut ? "success" : "secondary"}>
                    {p.isIssuedOut ? "Issued" : "In progress"}
                  </Badge>
                </TableCell>
                {showFinancials && (
                  <>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(p.approvedFee)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
                          p.isPaid
                            ? "bg-emerald-100 text-emerald-700"
                            : p.isInvoiced
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {p.isPaid ? "Paid" : p.isInvoiced ? "Invoiced" : "Not invoiced"}
                      </span>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {canCreate && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                Create a delivery project directly. A project number is assigned
                automatically.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createProject} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pr-name">Project name</Label>
                <Input
                  id="pr-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pr-client">Client name</Label>
                  <Input
                    id="pr-client"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pr-email">Client email</Label>
                  <Input
                    id="pr-email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-fee">Approved fee (AUD)</Label>
                <Input
                  id="pr-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={approvedFee}
                  onChange={(e) => setApprovedFee(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Scope of work</Label>
                <DisciplinePicker value={scope} onChange={setScope} />
              </div>
              <div className="space-y-1.5">
                <Label>Assign engineers</Label>
                <div className="flex flex-wrap gap-2">
                  {engineers.length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      No active engineers.
                    </span>
                  )}
                  {engineers.map((eng) => (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => toggleEngineer(eng.id)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        assigned.includes(eng.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {eng.name}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create project
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
