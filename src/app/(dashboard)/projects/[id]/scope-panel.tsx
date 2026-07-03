"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { DisciplinePicker } from "@/components/shared/discipline-picker";
import { DisciplineBadges } from "@/components/shared/discipline-badges";
import { cn } from "@/lib/utils";
import type { Discipline } from "@prisma/client";
import type { ProjectDetail } from "./types";

export function ScopePanel({
  project,
  canEdit,
  engineers,
}: {
  project: ProjectDetail;
  canEdit: boolean;
  engineers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [projectName, setProjectName] = useState(project.projectName);
  const [scope, setScope] = useState<Discipline[]>(project.scopeOfWork);
  const [isIssuedOut, setIsIssuedOut] = useState(project.isIssuedOut);
  const [assigned, setAssigned] = useState<string[]>(
    project.assignedEngineers.map((e) => e.id)
  );
  const [client, setClient] = useState(project.clientDetails);

  function toggleEngineer(id: string) {
    setAssigned((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        projectName,
        scopeOfWork: scope,
        isIssuedOut,
        clientDetails: client,
      };
      // Only admins can reassign engineers (engineers list is empty otherwise).
      if (engineers.length > 0) body.assignedEngineerIds = assigned;

      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Save failed", description: data.error, variant: "error" });
        return;
      }
      toast({ title: "Project updated", variant: "success" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    // Read-only view (BOOKKEEPER).
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scope & client (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Scope of work</p>
            <div className="mt-1">
              <DisciplineBadges disciplines={project.scopeOfWork} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Info label="Client" value={project.clientDetails.name} />
            <Info label="Company" value={project.clientDetails.company} />
            <Info label="Email" value={project.clientDetails.email} />
            <Info label="Phone" value={project.clientDetails.phone} />
            <Info label="Address" value={project.clientDetails.address} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={project.isIssuedOut ? "success" : "secondary"}>
              {project.isIssuedOut ? "Issued for construction" : "In progress"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scope & client</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="s-name">Project name</Label>
          <Input
            id="s-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Scope of work</Label>
          <DisciplinePicker value={scope} onChange={setScope} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Client name</Label>
            <Input
              value={client.name}
              onChange={(e) => setClient({ ...client, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input
              value={client.company}
              onChange={(e) => setClient({ ...client, company: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              value={client.email}
              onChange={(e) => setClient({ ...client, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={client.phone}
              onChange={(e) => setClient({ ...client, phone: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Site address</Label>
            <Input
              value={client.address}
              onChange={(e) => setClient({ ...client, address: e.target.value })}
            />
          </div>
        </div>

        {engineers.length > 0 && (
          <div className="space-y-1.5">
            <Label>Assigned engineers</Label>
            <div className="flex flex-wrap gap-2">
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
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isIssuedOut}
            onChange={(e) => setIsIssuedOut(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Issued for construction
        </label>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value || "—"}</p>
    </div>
  );
}
