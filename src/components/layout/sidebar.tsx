"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Handshake,
  FolderKanban,
  Clock,
  Users,
  Settings,
  HardHat,
  History,
  ClipboardCheck,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Handshake,
  FolderKanban,
  Clock,
  Users,
  Settings,
  FileSpreadsheet,
  History,
  ClipboardCheck,
};

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <HardHat className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">NepaEng</p>
          <p className="text-[11px] text-muted-foreground">Project Platform</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3 text-[11px] text-muted-foreground">
        NepaEng Platform v1.0
      </div>
    </aside>
  );
}
