import type { Role } from "@prisma/client";

/**
 * Central permission matrix for the platform.
 *
 * ┌─────────────────────────┬───────────────┬─────────────────┬──────────┬────────────┐
 * │ Resource                │ ADMINISTRATOR │ SENIOR_ENGINEER │ ENGINEER │ BOOKKEEPER │
 * ├─────────────────────────┼───────────────┼─────────────────┼──────────┼────────────┤
 * │ proposals               │ write         │ none            │ none     │ none       │
 * │ financials              │ write         │ none            │ none     │ write      │
 * │ projectScope            │ write         │ write           │ write    │ read       │
 * │ ganttComments           │ write         │ write           │ write    │ read       │
 * │ timesheets              │ write         │ write           │ write    │ read       │
 * │ timesheetApprovals      │ write         │ write           │ none     │ read       │
 * │ timesheetPayroll        │ write         │ read            │ none     │ write      │
 * │ userManagement          │ write         │ none            │ none     │ none       │
 * └─────────────────────────┴───────────────┴─────────────────┴──────────┴────────────┘
 *
 * Timesheet approval hierarchy:
 *  - ENGINEER timesheets → approved by SENIOR_ENGINEER or ADMINISTRATOR
 *  - SENIOR_ENGINEER timesheets → approved by ADMINISTRATOR only
 *  - ADMINISTRATOR timesheets → approved by another ADMINISTRATOR
 *  - BOOKKEEPER: read-only by default; may be granted approval via canApprove flag
 *
 * The `canApprove` flag on the User model gates actual approval actions at
 * the API level. The RBAC matrix here only gates page/route access.
 */

export type Resource =
  | "proposals"
  | "financials"
  | "projectScope"
  | "ganttComments"
  | "timesheets"
  | "timesheetApprovals"
  | "timesheetPayroll"
  | "userManagement";

export type Access = "none" | "read" | "write";

/** Access level per role per resource */
const MATRIX: Record<Resource, Record<Role, Access>> = {
  proposals: {
    ADMINISTRATOR: "write",
    SENIOR_ENGINEER: "none",
    ENGINEER: "none",
    BOOKKEEPER: "none",
  },
  financials: {
    ADMINISTRATOR: "write",
    SENIOR_ENGINEER: "none",
    ENGINEER: "none",
    BOOKKEEPER: "write",
  },
  projectScope: {
    ADMINISTRATOR: "write",
    SENIOR_ENGINEER: "write",
    ENGINEER: "write",
    BOOKKEEPER: "read",
  },
  ganttComments: {
    ADMINISTRATOR: "write",
    SENIOR_ENGINEER: "write",
    ENGINEER: "write",
    BOOKKEEPER: "read",
  },
  timesheets: {
    // All engineer roles can create/edit their own timesheets.
    // ADMIN can also create (e.g. on behalf of someone or their own).
    // BOOKKEEPER has read-only access to all timesheets.
    ADMINISTRATOR: "write",
    SENIOR_ENGINEER: "write",
    ENGINEER: "write",
    BOOKKEEPER: "read",
  },
  timesheetApprovals: {
    // Access to the approval queue/dashboard.
    // ADMIN + SENIOR_ENGINEER can approve (subject to hierarchy checks).
    // BOOKKEEPER gets read access (can view but not approve by default;
    // actual approval gated by canApprove flag on the user).
    ADMINISTRATOR: "write",
    SENIOR_ENGINEER: "write",
    ENGINEER: "none",
    BOOKKEEPER: "read",
  },
  timesheetPayroll: {
    // Bookkeeper payroll/reporting dashboard.
    // ADMIN has full access, BOOKKEEPER has write (export), SENIOR can view.
    ADMINISTRATOR: "write",
    SENIOR_ENGINEER: "read",
    ENGINEER: "none",
    BOOKKEEPER: "write",
  },
  userManagement: {
    ADMINISTRATOR: "write",
    SENIOR_ENGINEER: "none",
    ENGINEER: "none",
    BOOKKEEPER: "none",
  },
};

export function accessFor(role: Role, resource: Resource): Access {
  return MATRIX[resource][role];
}

export function canRead(role: Role, resource: Resource): boolean {
  const a = accessFor(role, resource);
  return a === "read" || a === "write";
}

export function canWrite(role: Role, resource: Resource): boolean {
  return accessFor(role, resource) === "write";
}

/** True when the role must not even see the resource (hidden from DOM / 403). */
export function isHidden(role: Role, resource: Resource): boolean {
  return accessFor(role, resource) === "none";
}

/**
 * Route-prefix -> required resource + minimum access.
 * Used by middleware to gate page navigation. The longest matching prefix wins.
 */
export const ROUTE_GUARDS: Array<{
  prefix: string;
  resource: Resource;
  access: Exclude<Access, "none">;
}> = [
  { prefix: "/admin/users", resource: "userManagement", access: "read" },
  { prefix: "/admin", resource: "userManagement", access: "read" },
  { prefix: "/proposals", resource: "proposals", access: "read" },
  { prefix: "/timesheets/approvals", resource: "timesheetApprovals", access: "read" },
  { prefix: "/timesheets/payroll", resource: "timesheetPayroll", access: "read" },
  { prefix: "/timesheets", resource: "timesheets", access: "read" },
  { prefix: "/settings/myob", resource: "financials", access: "read" },
];

export function guardForPath(pathname: string) {
  const matches = ROUTE_GUARDS.filter((g) => pathname.startsWith(g.prefix));
  if (matches.length === 0) return null;
  // longest prefix wins
  return matches.sort((a, b) => b.prefix.length - a.prefix.length)[0];
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRATOR: "Administrator",
  SENIOR_ENGINEER: "Senior Engineer",
  ENGINEER: "Engineer",
  BOOKKEEPER: "Bookkeeper",
};

/**
 * Role hierarchy levels for timesheet approval.
 * Higher number = higher authority. A user can only approve timesheets
 * from roles with a LOWER level than their own.
 */
export const ROLE_LEVEL: Record<Role, number> = {
  ENGINEER: 1,
  SENIOR_ENGINEER: 2,
  BOOKKEEPER: 2, // Same level as senior; cannot approve senior engineers
  ADMINISTRATOR: 3,
};

/**
 * Determines if a given approver role can approve a given employee role's
 * timesheets based on the hierarchy.
 *
 * Rules:
 * - Engineers → Senior Engineers or Administrators
 * - Senior Engineers → Administrators only
 * - Administrators → other Administrators only
 * - Bookkeepers → can approve Engineers if canApprove flag is set (checked elsewhere)
 * - Nobody can approve their own timesheet
 */
export function canRoleApprove(approverRole: Role, employeeRole: Role): boolean {
  // Administrators can approve anyone (except themselves, checked at API level)
  if (approverRole === "ADMINISTRATOR") return true;

  // Senior Engineers can approve Engineers
  if (approverRole === "SENIOR_ENGINEER" && employeeRole === "ENGINEER") return true;

  // Bookkeepers: approval gated by canApprove flag on user, but role-level
  // they can only approve Engineers (same level cannot approve same level)
  if (approverRole === "BOOKKEEPER" && employeeRole === "ENGINEER") return true;

  return false;
}

/**
 * Timesheet-specific permissions derived from the spec's permissions matrix.
 *
 * | Permission              | Employee | Senior Engineer | Bookkeeper | Admin |
 * |-------------------------|----------|-----------------|------------|-------|
 * | Create Timesheet        | ✓        | ✓               | ✗          | ✓     |
 * | Edit Draft              | ✓        | ✓               | ✗          | ✓     |
 * | Submit                  | ✓        | ✓               | ✗          | ✓     |
 * | View Team               | ✗        | ✓               | ✓          | ✓     |
 * | Approve Team            | ✗        | ✓               | Optional   | ✓     |
 * | Approve Senior Engineer | ✗        | ✗               | ✗          | ✓     |
 * | Reject                  | ✗        | ✓               | Optional   | ✓     |
 * | Unlock Approved         | ✗        | ✗               | ✗          | ✓     |
 * | Export PDF              | Own Only | Team            | All        | All   |
 */
export type TimesheetPermission =
  | "createTimesheet"
  | "editDraft"
  | "submit"
  | "viewTeam"
  | "approveTeam"
  | "approveSenior"
  | "reject"
  | "unlockApproved"
  | "exportPdfOwn"
  | "exportPdfTeam"
  | "exportPdfAll";

const TS_PERMISSIONS: Record<TimesheetPermission, Record<Role, boolean>> = {
  createTimesheet: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: true,
    ENGINEER: true,
    BOOKKEEPER: false,
  },
  editDraft: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: true,
    ENGINEER: true,
    BOOKKEEPER: false,
  },
  submit: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: true,
    ENGINEER: true,
    BOOKKEEPER: false,
  },
  viewTeam: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: true,
    ENGINEER: false,
    BOOKKEEPER: true,
  },
  approveTeam: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: true,
    ENGINEER: false,
    BOOKKEEPER: false, // Optional via canApprove flag
  },
  approveSenior: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: false,
    ENGINEER: false,
    BOOKKEEPER: false,
  },
  reject: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: true,
    ENGINEER: false,
    BOOKKEEPER: false, // Optional via canApprove flag
  },
  unlockApproved: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: false,
    ENGINEER: false,
    BOOKKEEPER: false,
  },
  exportPdfOwn: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: true,
    ENGINEER: true,
    BOOKKEEPER: true,
  },
  exportPdfTeam: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: true,
    ENGINEER: false,
    BOOKKEEPER: true,
  },
  exportPdfAll: {
    ADMINISTRATOR: true,
    SENIOR_ENGINEER: false,
    ENGINEER: false,
    BOOKKEEPER: true,
  },
};

/**
 * Check if a role has a specific timesheet permission.
 * Note: For BOOKKEEPER approve/reject, also check the user's `canApprove` flag.
 */
export function hasTimesheetPermission(
  role: Role,
  permission: TimesheetPermission
): boolean {
  return TS_PERMISSIONS[permission][role];
}
