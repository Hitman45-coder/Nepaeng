"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Discipline, ProposalStatus } from "@prisma/client";
import { ArrowRightCircle, Loader2, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/shared/page-header";
import { DisciplineBadges } from "@/components/shared/discipline-badges";
import { DisciplinePicker } from "@/components/shared/discipline-picker";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ProposalRow {
  id: string;
  proposalNumber: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  proposedFee: number;
  scope: Discipline[];
  status: ProposalStatus;
  createdAt: string;
  convertedProject: { id: string; projectNumber: string } | null;
}

const STATUS_VARIANT: Record<ProposalStatus, "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  WON: "success",
  LOST: "destructive",
};

export function ProposalsClient({
  initialProposals,
}: {
  initialProposals: ProposalRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [proposals, setProposals] = useState(initialProposals);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // create form
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [proposedFee, setProposedFee] = useState("");
  const [scope, setScope] = useState<Discipline[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function createProposal(e: React.FormEvent) {
    e.preventDefault();
    if (scope.length === 0) {
      toast({ title: "Select at least one discipline", variant: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          clientName,
          clientEmail,
          clientCompany: clientCompany || null,
          proposedFee,
          scope,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Create failed", description: data.error, variant: "error" });
        return;
      }
      setOpen(false);
      setProjectName("");
      setClientName("");
      setClientEmail("");
      setClientCompany("");
      setProposedFee("");
      setScope([]);
      toast({ title: "Proposal created", variant: "success" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(id: string, status: ProposalStatus) {
    const res = await fetch(`/api/proposals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast({ title: "Update failed", description: d.error, variant: "error" });
      return;
    }
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p))
    );
  }

  async function convert(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/proposals/${id}/convert`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Convert failed", description: data.error, variant: "error" });
        return;
      }
      toast({
        title: "Project created",
        description: `${data.project.projectNumber}`,
        variant: "success",
      });
      router.push(`/projects/${data.project.id}`);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this proposal?")) return;
    const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Delete failed", description: data.error, variant: "error" });
      return;
    }
    setProposals((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      <PageHeader
        title="Proposals & CRM"
        description="Track opportunities and convert won proposals into delivery projects."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New proposal
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proposal</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No proposals yet.
                </TableCell>
              </TableRow>
            )}
            {proposals.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.projectName}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.proposalNumber}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{p.clientName}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.clientCompany || p.clientEmail}
                  </div>
                </TableCell>
                <TableCell>
                  <DisciplineBadges disciplines={p.scope} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(p.proposedFee)}
                </TableCell>
                <TableCell>
                  {p.convertedProject ? (
                    <Badge variant="success">
                      Won · {p.convertedProject.projectNumber}
                    </Badge>
                  ) : (
                    <Select
                      value={p.status}
                      onValueChange={(v) => setStatus(p.id, v as ProposalStatus)}
                    >
                      <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="WON">Won</SelectItem>
                        <SelectItem value="LOST">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(p.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {!p.convertedProject ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => convert(p.id)}
                        disabled={busyId === p.id}
                      >
                        {busyId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRightCircle className="h-4 w-4" />
                        )}
                        Convert
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/projects/${p.convertedProject!.id}`)
                        }
                      >
                        View project
                      </Button>
                    )}
                    {!p.convertedProject && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(p.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New proposal</DialogTitle>
            <DialogDescription>
              A proposal number is assigned automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createProposal} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Project name</Label>
              <Input
                id="p-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Client name</Label>
                <Input
                  id="c-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Client email</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-company">Company (optional)</Label>
                <Input
                  id="c-company"
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fee">Proposed fee (AUD)</Label>
                <Input
                  id="fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={proposedFee}
                  onChange={(e) => setProposedFee(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Scope of work</Label>
              <DisciplinePicker value={scope} onChange={setScope} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create proposal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
