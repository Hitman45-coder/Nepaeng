export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, requireUser } from "@/lib/api-auth";

/**
 * GET /api/timesheets/projects?q=search
 *
 * Returns active projects assigned to the current employee for the timesheet
 * project lookup dropdown. Supports search filtering.
 *
 * Equivalent to:
 *   SELECT ProjectID, ProjectCode, ProjectName
 *   FROM Projects WHERE Status='Active'
 *   ORDER BY ProjectName
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    // For engineers, only show projects assigned to them.
    // For admins/bookkeepers, show all active projects.
    const isEngineer = user.role === "ENGINEER";

    const projects = await prisma.project.findMany({
      where: {
        isIssuedOut: false, // Active (not yet issued/closed)
        ...(q
          ? {
              OR: [
                { projectName: { contains: q, mode: "insensitive" } },
                { projectNumber: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(isEngineer
          ? { assignedEngineers: { some: { id: user.id } } }
          : {}),
      },
      orderBy: { projectName: "asc" },
      select: {
        id: true,
        projectNumber: true,
        projectName: true,
      },
      take: 50,
    });

    return NextResponse.json({ projects });
  } catch (err) {
    return errorResponse(err);
  }
}
