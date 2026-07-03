import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";

/**
 * POST /api/timesheets/:id/unlock
 *
 * Only users with `canUnlockApproved` permission (typically ADMINISTRATOR / HR Admin)
 * can unlock an APPROVED timesheet, returning it to DRAFT for editing.
 *
 * Per spec: "Only HR Admin can unlock."
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    // Check the user's canUnlockApproved flag
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { canUnlockApproved: true },
    });

    if (!fullUser?.canUnlockApproved && user.role !== "ADMINISTRATOR") {
      throw new HttpError(403, "Only HR Admin can unlock approved timesheets");
    }

    const timesheet = await prisma.timesheetHeader.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });
    if (!timesheet) throw new HttpError(404, "Timesheet not found");

    if (timesheet.status !== "APPROVED") {
      throw new HttpError(
        400,
        `Can only unlock APPROVED timesheets. Current status: ${timesheet.status}`
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ??
      req.headers.get("x-real-ip") ??
      null;

    const updated = await prisma.$transaction(async (tx) => {
      const ts = await tx.timesheetHeader.update({
        where: { id: params.id },
        data: {
          status: "DRAFT",
          approvedDate: null,
          approvedById: null,
          approvalComment: null,
          modifiedBy: user.id,
          ipAddress: ip,
        },
      });

      await tx.approvalHistory.create({
        data: {
          timesheetId: params.id,
          status: "DRAFT",
          comment: "Unlocked by HR Admin",
          userId: user.id,
          ipAddress: ip,
        },
      });

      return ts;
    });

    return NextResponse.json({ timesheet: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
