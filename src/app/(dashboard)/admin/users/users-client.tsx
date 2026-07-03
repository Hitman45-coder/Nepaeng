"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { Copy, KeyRound, Loader2, Plus, Settings2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
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
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { TimesheetSettingsDialog } from "./timesheet-settings-dialog";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustResetPassword: boolean;
  createdAt: string;
}

const ROLES: Role[] = ["ADMINISTRATOR", "SENIOR_ENGINEER", "ENGINEER", "BOOKKEEPER"];

export function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [createOpen, setCreateOpen] = useState(false);
  const [tsSettingsUser, setTsSettingsUser] = useState<{ id: string; name: string } | null>(null);
  const [tempPwInfo, setTempPwInfo] = useState<{
    name: string;
    password: string;
  } | null>(null);

  // create form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ENGINEER");
  const [submitting, setSubmitting] = useState(false);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not create user", description: data.error, variant: "error" });
        return;
      }
      setCreateOpen(false);
      setName("");
      setEmail("");
      setRole("ENGINEER");
      setTempPwInfo({ name: data.user.name, password: data.tempPassword });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(id: string, newRole: Role) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Update failed", description: data.error, variant: "error" });
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    toast({ title: "Role updated", variant: "success" });
  }

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Update failed", description: data.error, variant: "error" });
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isActive } : u)));
  }

  async function resetPassword(u: UserRow) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-password" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Reset failed", description: data.error, variant: "error" });
      return;
    }
    setTempPwInfo({ name: u.name, password: data.tempPassword });
    setUsers((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, mustResetPassword: true } : x))
    );
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
    toast({ title: "Copied to clipboard", variant: "success" });
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Create users, assign roles, and issue temporary passwords."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            New user
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  {u.id === currentUserId ? (
                    <Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge>
                  ) : (
                    <Select
                      value={u.role}
                      onValueChange={(v) => changeRole(u.id, v as Role)}
                    >
                      <SelectTrigger className="h-8 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={u.isActive ? "success" : "destructive"}>
                      {u.isActive ? "Active" : "Disabled"}
                    </Badge>
                    {u.mustResetPassword && (
                      <Badge variant="warning">Temp password</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(u.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTsSettingsUser({ id: u.id, name: u.name })}
                      title="Timesheet Settings"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetPassword(u)}
                    >
                      <KeyRound className="h-4 w-4" />
                      Reset
                    </Button>
                    {u.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(u.id, !u.isActive)}
                      >
                        {u.isActive ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              A temporary password will be generated. The user must change it on
              first login.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Full name</Label>
              <Input
                id="u-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Temporary password reveal dialog */}
      <Dialog
        open={!!tempPwInfo}
        onOpenChange={(o) => !o && setTempPwInfo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Share this with {tempPwInfo?.name}. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
            <code className="flex-1 font-mono text-sm">
              {tempPwInfo?.password}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => tempPwInfo && copy(tempPwInfo.password)}
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPwInfo(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timesheet settings dialog */}
      {tsSettingsUser && (
        <TimesheetSettingsDialog
          userId={tsSettingsUser.id}
          userName={tsSettingsUser.name}
          open={!!tsSettingsUser}
          onOpenChange={(open) => !open && setTsSettingsUser(null)}
        />
      )}
    </div>
  );
}
