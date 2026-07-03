"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import type { ProjectDetail } from "./types";

export function FinancialsPanel({
  project,
  canEdit,
}: {
  project: ProjectDetail;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [approvedFee, setApprovedFee] = useState(
    project.approvedFee !== null ? String(project.approvedFee) : ""
  );
  const [myobCustomerUid, setMyobCustomerUid] = useState(
    project.clientDetails.myobCustomerUid ?? ""
  );
  const [isInvoiced, setIsInvoiced] = useState(project.isInvoiced);
  const [isPaid, setIsPaid] = useState(project.isPaid);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvedFee,
          isInvoiced,
          isPaid,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Save failed", description: data.error, variant: "error" });
        return;
      }
      toast({ title: "Financials updated", variant: "success" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createInvoice() {
    if (!myobCustomerUid) {
      toast({
        title: "MYOB customer UID required",
        description: "Enter the customer UID before raising an invoice.",
        variant: "error",
      });
      return;
    }
    setInvoicing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", myobCustomerUid }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Invoice failed", description: data.error, variant: "error" });
        return;
      }
      toast({
        title: "MYOB invoice created",
        description: data.invoiceNumber ? `#${data.invoiceNumber}` : undefined,
        variant: "success",
      });
      router.refresh();
    } finally {
      setInvoicing(false);
    }
  }

  async function syncStatus() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Sync failed", description: data.error, variant: "error" });
        return;
      }
      toast({
        title: data.isPaid ? "Invoice is paid" : "Status synced",
        variant: "success",
      });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Project financials</CardTitle>
        <div className="flex gap-1">
          <Badge variant={project.isPaid ? "success" : project.isInvoiced ? "warning" : "secondary"}>
            {project.isPaid ? "Paid" : project.isInvoiced ? "Invoiced" : "Not invoiced"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Approved fee (AUD)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={approvedFee}
              disabled={!canEdit}
              onChange={(e) => setApprovedFee(e.target.value)}
            />
            {!canEdit && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(project.approvedFee)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>MYOB invoice #</Label>
            <Input value={project.myobInvoiceNumber ?? "—"} disabled readOnly />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>MYOB customer UID</Label>
          <Input
            value={myobCustomerUid}
            disabled={!canEdit}
            placeholder="e.g. 7d8e1f2a-…"
            onChange={(e) => setMyobCustomerUid(e.target.value)}
          />
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isInvoiced}
                onChange={(e) => setIsInvoiced(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Invoiced
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Paid
            </label>
          </div>
        )}

        {canEdit && (
          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={createInvoice}
                disabled={invoicing || project.isInvoiced}
              >
                {invoicing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Create MYOB invoice
              </Button>
              <Button
                variant="outline"
                onClick={syncStatus}
                disabled={syncing || !project.myobInvoiceUid}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync payment status
              </Button>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
