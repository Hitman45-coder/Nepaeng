export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, requireAccess } from "@/lib/api-auth";

/**
 * GET /api/users/approvers?exclude=userId
 *
 * Returns a list of users who can potentially serve as approvers.
 * Filters to active users with SENIOR_ENGINEER or ADMINISTRATOR role,
 * plus any BOOKKEEPER with canApprove=true.
 *
 * Used by the Timesheet Settings form to populate approver dropdowns.
 */
export async function GET(req: Request) {
  try {
    await requireAccess("userManagement", "read");

    const { searchParams } = new URL(req.url);
    const excludeId = searchParams.get("exclude");

    const approvers = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { role: "ADMINISTRATOR" },
          { role: "SENIOR_ENGINEER" },
          { role: "BOOKKEEPER", canApprove: true },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ approvers });
  } catch (err) {
    return errorResponse(err);
  }
}
