import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAccess } from "@/lib/api-auth";
import { validateNoCircularAssignment } from "@/lib/approval-hierarchy";
import { z } from "zod";

const timesheetSettingsSchema = z.object({
  department: z.string().optional().nullable(),
  team: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  defaultApproverId: z.string().uuid().optional().nullable(),
  backupApproverId: z.string().uuid().optional().nullable(),
  timesheetEnabled: z.boolean().optional(),
  canApprove: z.boolean().optional(),
  canExportPdf: z.boolean().optional(),
  canUnlockApproved: z.boolean().optional(),
  maxWeeklyHours: z.coerce.number().min(0).max(168).optional(),
  expectedDailyHours: z.coerce.number().min(0).max(24).optional(),
});

/**
 * GET /api/users/:id/timesheet-settings
 *
 * Retrieve the timesheet-related settings for a user.
 * ADMINISTRATOR only.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAccess("userManagement", "read");

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        team: true,
        position: true,
        timesheetEnabled: true,
        canApprove: true,
        canExportPdf: true,
        canUnlockApproved: true,
        maxWeeklyHours: true,
        expectedDailyHours: true,
        defaultApprover: { select: { id: true, name: true, email: true } },
        backupApprover: { select: { id: true, name: true, email: true } },
      },
    });

    if (!user) throw new HttpError(404, "User not found");

    return NextResponse.json({ settings: user });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH /api/users/:id/timesheet-settings
 *
 * Update the timesheet-related settings for a user.
 * ADMINISTRATOR only.
 *
 * Validates:
 * - Approver cannot be the user themselves
 * - No circular approval assignments
 * - Approver must exist and be active
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAccess("userManagement", "write");

    const json = await req.json();
    const parsed = timesheetSettingsSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input"
      );
    }

    const data = parsed.data;

    // Validate default approver
    if (data.defaultApproverId) {
      if (data.defaultApproverId === params.id) {
        throw new HttpError(400, "A user cannot be their own approver");
      }
      const approver = await prisma.user.findUnique({
        where: { id: data.defaultApproverId },
        select: { id: true, isActive: true },
      });
      if (!approver || !approver.isActive) {
        throw new HttpError(400, "Default approver not found or is inactive");
      }
      // Check for circular assignment
      const circularCheck = await validateNoCircularAssignment(
        params.id,
        data.defaultApproverId
      );
      if (!circularCheck.allowed) {
        throw new HttpError(400, circularCheck.reason!);
      }
    }

    // Validate backup approver
    if (data.backupApproverId) {
      if (data.backupApproverId === params.id) {
        throw new HttpError(400, "A user cannot be their own backup approver");
      }
      if (data.backupApproverId === data.defaultApproverId) {
        throw new HttpError(
          400,
          "Backup approver must be different from the default approver"
        );
      }
      const approver = await prisma.user.findUnique({
        where: { id: data.backupApproverId },
        select: { id: true, isActive: true },
      });
      if (!approver || !approver.isActive) {
        throw new HttpError(400, "Backup approver not found or is inactive");
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};
    if (data.department !== undefined) updateData.department = data.department;
    if (data.team !== undefined) updateData.team = data.team;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.defaultApproverId !== undefined)
      updateData.defaultApproverId = data.defaultApproverId;
    if (data.backupApproverId !== undefined)
      updateData.backupApproverId = data.backupApproverId;
    if (data.timesheetEnabled !== undefined)
      updateData.timesheetEnabled = data.timesheetEnabled;
    if (data.canApprove !== undefined) updateData.canApprove = data.canApprove;
    if (data.canExportPdf !== undefined)
      updateData.canExportPdf = data.canExportPdf;
    if (data.canUnlockApproved !== undefined)
      updateData.canUnlockApproved = data.canUnlockApproved;
    if (data.maxWeeklyHours !== undefined)
      updateData.maxWeeklyHours = data.maxWeeklyHours;
    if (data.expectedDailyHours !== undefined)
      updateData.expectedDailyHours = data.expectedDailyHours;

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updateData as any,
      select: {
        id: true,
        name: true,
        department: true,
        team: true,
        position: true,
        timesheetEnabled: true,
        canApprove: true,
        canExportPdf: true,
        canUnlockApproved: true,
        maxWeeklyHours: true,
        expectedDailyHours: true,
        defaultApprover: { select: { id: true, name: true } },
        backupApprover: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ settings: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
