"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Role } from "@prisma/client";

export function Topbar({
  name,
  email,
  role,
  items,
}: {
  name: string;
  email: string;
  role: Role;
  items: { label: string; href: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const matched = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const title = matched?.label ?? "Dashboard";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
      <h1 className="text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            <span className="hidden sm:inline">{name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="leading-tight">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs font-normal text-muted-foreground">
                  {email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/change-password")}>
              Change password
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={logout} className="text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
