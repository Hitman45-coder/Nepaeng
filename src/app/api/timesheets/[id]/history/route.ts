import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";

/**
 * GET /api/timesheets/:id/history
 *
 * Get the full approval/action history for a timesheet.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    const timesheet = await prisma.timesheetHeader.findUnique({
      where: { id: params.id },
      select: { id: true, employeeId: true },
    });
    if (!timesheet) throw new HttpError(404, "Timesheet not found");

    // Engineers can only view history of their own timesheets
    if (user.role === "ENGINEER" && timesheet.employeeId !== user.id) {
      throw new HttpError(403, "You can only view your own timesheet history");
    }

    const history = await prisma.approvalHistory.findMany({
      where: { timesheetId: params.id },
      orderBy: { actionDate: "desc" },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ history });
  } catch (err) {
    return errorResponse(err);
  }
}
