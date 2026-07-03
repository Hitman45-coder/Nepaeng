import { z } from "zod";
import { Role, Discipline, ProposalStatus } from "@prisma/client";

const disciplineEnum = z.nativeEnum(Discipline);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  });

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.nativeEnum(Role),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

export const createProposalSchema = z.object({
  projectName: z.string().min(2),
  clientName: z.string().min(2),
  clientEmail: z.string().email(),
  clientCompany: z.string().optional().nullable(),
  proposedFee: z.coerce.number().nonnegative(),
  scope: z.array(disciplineEnum).min(1),
});

export const updateProposalSchema = z.object({
  projectName: z.string().min(2).optional(),
  clientName: z.string().min(2).optional(),
  clientEmail: z.string().email().optional(),
  clientCompany: z.string().optional().nullable(),
  proposedFee: z.coerce.number().nonnegative().optional(),
  scope: z.array(disciplineEnum).min(1).optional(),
  status: z.nativeEnum(ProposalStatus).optional(),
});

export const clientDetailsSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  myobCustomerUid: z.string().nullable().optional(),
});

export const createProjectSchema = z.object({
  projectName: z.string().min(2),
  clientDetails: clientDetailsSchema,
  approvedFee: z.coerce.number().nonnegative(),
  scopeOfWork: z.array(disciplineEnum).min(1),
  assignedEngineerIds: z.array(z.string().uuid()).default([]),
});

// Fields editable by ADMIN or ENGINEER (scope/assignment/issue status).
export const updateProjectScopeSchema = z.object({
  projectName: z.string().min(2).optional(),
  clientDetails: clientDetailsSchema.optional(),
  scopeOfWork: z.array(disciplineEnum).min(1).optional(),
  assignedEngineerIds: z.array(z.string().uuid()).optional(),
  isIssuedOut: z.boolean().optional(),
});

// Fields editable by ADMIN or BOOKKEEPER (financials).
export const updateProjectFinancialsSchema = z.object({
  approvedFee: z.coerce.number().nonnegative().optional(),
  myobInvoiceNumber: z.string().optional().nullable(),
  myobInvoiceUid: z.string().optional().nullable(),
  isInvoiced: z.boolean().optional(),
  isPaid: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  text: z.string().min(1),
  ganttStart: z.coerce.date(),
  ganttEnd: z.coerce.date(),
  progressPct: z.coerce.number().int().min(0).max(100).default(0),
  discipline: disciplineEnum.optional().nullable(),
});

export const updateCommentSchema = z.object({
  text: z.string().min(1).optional(),
  ganttStart: z.coerce.date().optional(),
  ganttEnd: z.coerce.date().optional(),
  progressPct: z.coerce.number().int().min(0).max(100).optional(),
  discipline: disciplineEnum.optional().nullable(),
});

// =============================================================================
// TIMESHEET MODULE — Validation Schemas
// =============================================================================

import { TimesheetStatus, ActivityType } from "@prisma/client";

const activityTypeEnum = z.nativeEnum(ActivityType);
const timesheetStatusEnum = z.nativeEnum(TimesheetStatus);

/** Validates a single hour cell value: 0, 0.5, 1, 1.5, ... up to 12 (0.5 increments) */
const hourCell = z.coerce
  .number()
  .min(0, "Hours cannot be negative")
  .max(12, "Maximum 12 hours per day")
  .refine(
    (v) => v * 2 === Math.round(v * 2),
    "Hours must be in 0.5 increments"
  );

/** Schema for a single line in the timesheet grid */
export const timesheetLineSchema = z
  .object({
    id: z.string().uuid().optional(), // present when updating existing line
    projectId: z.string().uuid().nullable().optional(),
    activityType: activityTypeEnum.default("PROJECT"),
    sunday: hourCell.default(0),
    monday: hourCell.default(0),
    tuesday: hourCell.default(0),
    wednesday: hourCell.default(0),
    thursday: hourCell.default(0),
    friday: hourCell.default(0),
    lineComment: z.string().optional().nullable(), // Per-row comment
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (line) => {
      // If activityType is PROJECT, projectId must be provided
      if (line.activityType === "PROJECT" && !line.projectId) {
        return false;
      }
      return true;
    },
    { message: "Project ID is required for project lines" }
  );

export type TimesheetLineInput = z.infer<typeof timesheetLineSchema>;

/** Schema for creating or saving (auto-save/draft) a timesheet */
export const saveTimesheetSchema = z.object({
  weekStart: z.coerce.date(),
  lines: z.array(timesheetLineSchema).min(0),
  weeklyComment: z.string().optional().nullable(),
});

/** Schema for updating (PUT) a timesheet — same as save but with ID */
export const updateTimesheetSchema = z.object({
  lines: z.array(timesheetLineSchema).min(0),
  weeklyComment: z.string().optional().nullable(),
});

/** Schema for the approval/rejection action by a manager */
export const approvalActionSchema = z.object({
  comment: z.string().optional().nullable(),
});

/** Schema for rejection — comment is required */
export const rejectActionSchema = z.object({
  comment: z.string().min(1, "A comment is required when rejecting"),
});

// ---- Constants for the timesheet business rules ----
export const TIMESHEET_CONSTANTS = {
  WEEKLY_REQUIRED_HOURS: 42,
  DAILY_MAX_HOURS: 12,
  DAILY_EXPECTED_HOURS: 7,
  DAYS: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"] as const,
  DAY_LABELS: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"] as const,
} as const;

export type DayColumn = (typeof TIMESHEET_CONSTANTS.DAYS)[number];

/** System activities that are not project-based */
export const SYSTEM_ACTIVITIES: Array<{
  type: ActivityType;
  label: string;
}> = [
  { type: "ANNUAL_LEAVE", label: "Annual Leave" },
  { type: "MEDICAL_LEAVE", label: "Medical Leave" },
  { type: "TRAINING", label: "Training" },
  { type: "PUBLIC_HOLIDAY", label: "Public Holiday" },
  { type: "OFFICE", label: "Office" },
  { type: "ADMINISTRATION", label: "Administration" },
];

/** Validate the full weekly total doesn't exceed 42 hours */
export function validateWeeklyTotal(lines: TimesheetLineInput[]): {
  total: number;
  isValid: boolean;
  remaining: number;
} {
  let total = 0;
  for (const line of lines) {
    total +=
      (line.sunday ?? 0) +
      (line.monday ?? 0) +
      (line.tuesday ?? 0) +
      (line.wednesday ?? 0) +
      (line.thursday ?? 0) +
      (line.friday ?? 0);
  }
  total = Math.round(total * 10) / 10; // avoid floating point issues
  return {
    total,
    isValid: total <= TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS,
    remaining: Math.max(0, TIMESHEET_CONSTANTS.WEEKLY_REQUIRED_HOURS - total),
  };
}

/** Validate daily column totals don't exceed 12 hours */
export function validateDailyTotals(
  lines: TimesheetLineInput[]
): Record<DayColumn, { total: number; isValid: boolean }> {
  const result = {} as Record<DayColumn, { total: number; isValid: boolean }>;
  for (const day of TIMESHEET_CONSTANTS.DAYS) {
    const total = lines.reduce((sum, line) => sum + ((line[day] as number) ?? 0), 0);
    result[day] = {
      total: Math.round(total * 10) / 10,
      isValid: total <= TIMESHEET_CONSTANTS.DAILY_MAX_HOURS,
    };
  }
  return result;
}
