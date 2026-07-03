import "server-only";
import { prisma } from "@/lib/prisma";
import { canRoleApprove, ROLE_LEVEL } from "@/lib/rbac";
import type { Role } from "@prisma/client";

/**
 * Approval Hierarchy Validation Service
 *
 * Enforces the following rules:
 * 1. Engineers cannot approve their own timesheets.
 * 2. Senior Engineers can approve Engineers.
 * 3. Senior Engineers cannot approve their own timesheets.
 * 4. Senior Engineers' timesheets are approved by an Administrator.
 * 5. Administrators can approve any timesheet (except their own).
 * 6. Bookkeepers have read-only by default; may approve Engineers if canApprove flag is set.
 * 7. The system must prevent circular approval assignments.
 */

// ---- Types ----------------------------------------------------------------

export interface ApprovalValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface ApproverInfo {
  id: string;
  name: string;
  email: string;
  role: Role;
  canApprove: boolean;
}

// ---- Self-Approval Check --------------------------------------------------

/**
 * Rule: No user can approve their own timesheet.
 */
export function validateNotSelfApproval(
  approverId: string,
  employeeId: string
): ApprovalValidationResult {
  if (approverId === employeeId) {
    return {
      allowed: false,
      reason: "You cannot approve your own timesheet",
    };
  }
  return { allowed: true };
}

// ---- Role-Level Check -----------------------------------------------------

/**
 * Validates that the approver's role has sufficient authority to approve
 * the employee's role level.
 *
 * Also checks the `canApprove` flag for Bookkeepers.
 */
export function validateRoleHierarchy(
  approverRole: Role,
  approverCanApprove: boolean,
  employeeRole: Role
): ApprovalValidationResult {
  // Bookkeeper special case: must have canApprove flag
  if (approverRole === "BOOKKEEPER" && !approverCanApprove) {
    return {
      allowed: false,
      reason: "Your account does not have approval permissions. Contact an administrator.",
    };
  }

  // Check role-based hierarchy
  if (!canRoleApprove(approverRole, employeeRole)) {
    return {
      allowed: false,
      reason: `A ${approverRole} cannot approve a ${employeeRole}'s timesheet`,
    };
  }

  return { allowed: true };
}

// ---- Assigned Approver Check ----------------------------------------------

/**
 * Validates that the approver is the assigned approver (default or backup)
 * for the employee, OR is an Administrator (who can approve anyone).
 *
 * Returns the validation result. Administrators bypass this check.
 */
export async function validateAssignedApprover(
  approverId: string,
  approverRole: Role,
  employeeId: string
): Promise<ApprovalValidationResult> {
  // Administrators can approve anyone regardless of assignment
  if (approverRole === "ADMINISTRATOR") {
    return { allowed: true };
  }

  // Load the employee's assigned approvers
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: {
      defaultApproverId: true,
      backupApproverId: true,
      managerId: true,
    },
  });

  if (!employee) {
    return { allowed: false, reason: "Employee not found" };
  }

  const assignedApprovers = [
    employee.defaultApproverId,
    employee.backupApproverId,
    employee.managerId, // Legacy fallback
  ].filter(Boolean);

  if (assignedApprovers.includes(approverId)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "You are not the assigned approver for this employee's timesheets",
  };
}

// ---- Circular Assignment Detection ----------------------------------------

/**
 * Detects circular approval assignments.
 * Example: Employee A approves Employee B while Employee B approves Employee A.
 *
 * Performs a graph traversal (BFS) from the target user following the
 * defaultApproverId chain. If we encounter the source user, it's circular.
 *
 * @param employeeId - The user who is being assigned a new approver
 * @param proposedApproverId - The user being proposed as the new approver
 * @returns Validation result; `allowed: false` if circular
 */
export async function validateNoCircularAssignment(
  employeeId: string,
  proposedApproverId: string
): Promise<ApprovalValidationResult> {
  if (employeeId === proposedApproverId) {
    return {
      allowed: false,
      reason: "A user cannot be their own approver",
    };
  }

  // BFS: follow the approval chain from proposedApproverId upward.
  // If we reach employeeId, it's circular.
  const visited = new Set<string>();
  const queue: string[] = [proposedApproverId];
  const MAX_DEPTH = 20; // Safety limit
  let depth = 0;

  while (queue.length > 0 && depth < MAX_DEPTH) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    depth++;

    // Load who approves this user
    const user = await prisma.user.findUnique({
      where: { id: current },
      select: { defaultApproverId: true, backupApproverId: true },
    });

    if (!user) continue;

    const nextApprovers = [
      user.defaultApproverId,
      user.backupApproverId,
    ].filter(Boolean) as string[];

    for (const nextId of nextApprovers) {
      if (nextId === employeeId) {
        return {
          allowed: false,
          reason:
            "Circular approval assignment detected. This would create a loop where approvers approve each other.",
        };
      }
      if (!visited.has(nextId)) {
        queue.push(nextId);
      }
    }
  }

  return { allowed: true };
}

// ---- Full Approval Validation (combined) ----------------------------------

/**
 * Runs all approval validation checks in sequence.
 * Use this in the approve/reject API handlers.
 *
 * @returns First failing validation, or `{ allowed: true }` if all pass.
 */
export async function validateApprovalAction(params: {
  approverId: string;
  approverRole: Role;
  approverCanApprove: boolean;
  employeeId: string;
  employeeRole: Role;
}): Promise<ApprovalValidationResult> {
  const {
    approverId,
    approverRole,
    approverCanApprove,
    employeeId,
    employeeRole,
  } = params;

  // 1. Self-approval check
  const selfCheck = validateNotSelfApproval(approverId, employeeId);
  if (!selfCheck.allowed) return selfCheck;

  // 2. Role hierarchy check
  const hierarchyCheck = validateRoleHierarchy(
    approverRole,
    approverCanApprove,
    employeeRole
  );
  if (!hierarchyCheck.allowed) return hierarchyCheck;

  // 3. Assigned approver check
  const assignedCheck = await validateAssignedApprover(
    approverId,
    approverRole,
    employeeId
  );
  if (!assignedCheck.allowed) return assignedCheck;

  return { allowed: true };
}

// ---- Resolve Approver for an Employee ------------------------------------

/**
 * Determines who should approve a given employee's timesheet.
 * Returns the default approver, falling back to backup, then manager.
 * Returns null if no approver is assigned.
 */
export async function resolveApprover(
  employeeId: string
): Promise<ApproverInfo | null> {
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: {
      defaultApprover: {
        select: { id: true, name: true, email: true, role: true, canApprove: true, isActive: true },
      },
      backupApprover: {
        select: { id: true, name: true, email: true, role: true, canApprove: true, isActive: true },
      },
      manager: {
        select: { id: true, name: true, email: true, role: true, canApprove: true, isActive: true },
      },
    },
  });

  if (!employee) return null;

  // Prefer default approver if active
  if (employee.defaultApprover?.isActive) {
    const a = employee.defaultApprover;
    return { id: a.id, name: a.name, email: a.email, role: a.role, canApprove: a.canApprove };
  }

  // Fallback to backup approver
  if (employee.backupApprover?.isActive) {
    const a = employee.backupApprover;
    return { id: a.id, name: a.name, email: a.email, role: a.role, canApprove: a.canApprove };
  }

  // Fallback to legacy manager
  if (employee.manager?.isActive) {
    const a = employee.manager;
    return { id: a.id, name: a.name, email: a.email, role: a.role, canApprove: a.canApprove };
  }

  return null;
}

// ---- List Employees for an Approver --------------------------------------

/**
 * Returns all employees whose timesheets the given user can approve.
 * Based on the defaultApproverId / backupApproverId / managerId assignment.
 * Administrators see all employees.
 */
export async function getApprovableEmployees(
  approverId: string,
  approverRole: Role
): Promise<Array<{ id: string; name: string; email: string; role: Role; department: string | null; team: string | null }>> {
  // Administrators can approve anyone
  if (approverRole === "ADMINISTRATOR") {
    return prisma.user.findMany({
      where: {
        isActive: true,
        timesheetEnabled: true,
        id: { not: approverId }, // Exclude self
      },
      select: { id: true, name: true, email: true, role: true, department: true, team: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    });
  }

  // For Senior Engineers / Bookkeepers: only employees assigned to them
  return prisma.user.findMany({
    where: {
      isActive: true,
      timesheetEnabled: true,
      OR: [
        { defaultApproverId: approverId },
        { backupApproverId: approverId },
        { managerId: approverId },
      ],
    },
    select: { id: true, name: true, email: true, role: true, department: true, team: true },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });
}
