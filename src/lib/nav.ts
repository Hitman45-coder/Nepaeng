import type { Role } from "@prisma/client";
import { accessFor, type Resource } from "@/lib/rbac";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name
  /** Resource gate — item is hidden if the role has no access. */
  resource?: Resource;
}

const ALL_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  {
    label: "Proposals & CRM",
    href: "/proposals",
    icon: "Handshake",
    resource: "proposals",
  },
  { label: "Projects", href: "/projects", icon: "FolderKanban" },
  {
    label: "Timesheets",
    href: "/timesheets",
    icon: "Clock",
    resource: "timesheets",
  },
  {
    label: "Timesheet History",
    href: "/timesheets/history",
    icon: "History",
    resource: "timesheets",
  },
  {
    label: "Approvals",
    href: "/timesheets/approvals",
    icon: "ClipboardCheck",
    resource: "timesheetApprovals",
  },
  {
    label: "Payroll & Reports",
    href: "/timesheets/payroll",
    icon: "FileSpreadsheet",
    resource: "timesheetPayroll",
  },
  {
    label: "User Management",
    href: "/admin/users",
    icon: "Users",
    resource: "userManagement",
  },
  {
    label: "MYOB Settings",
    href: "/settings/myob",
    icon: "Settings",
    resource: "financials",
  },
];

/** Nav items visible to a given role (resource access != "none"). */
export function navForRole(role: Role): NavItem[] {
  return ALL_NAV.filter(
    (item) => !item.resource || accessFor(role, item.resource) !== "none"
  );
}
