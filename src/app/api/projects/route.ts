import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createProjectSchema } from "@/lib/validation";
import {
  errorResponse,
  HttpError,
  requireRole,
  requireUser,
} from "@/lib/api-auth";
import { nextProjectNumber } from "@/lib/numbering";

// GET /api/projects — all authenticated roles can list projects.
export async function GET() {
  try {
    await requireUser();
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assignedEngineers: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ projects });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/projects — create directly (ADMIN only; engineers use convert flow).
export async function POST(req: Request) {
  try {
    await requireRole("ADMINISTRATOR");
    const json = await req.json();
    const parsed = createProjectSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input"
      );
    }
    const { assignedEngineerIds, clientDetails, ...rest } = parsed.data;

    const project = await prisma.project.create({
      data: {
        projectNumber: await nextProjectNumber(),
        projectName: rest.projectName,
        approvedFee: rest.approvedFee,
        scopeOfWork: rest.scopeOfWork,
        clientDetails: { ...clientDetails, myobCustomerUid: clientDetails.myobCustomerUid ?? null },
        assignedEngineers: assignedEngineerIds.length
          ? { connect: assignedEngineerIds.map((id) => ({ id })) }
          : undefined,
      },
      select: { id: true, projectNumber: true },
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
