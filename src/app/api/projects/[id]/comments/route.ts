import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCommentSchema } from "@/lib/validation";
import {
  errorResponse,
  HttpError,
  requireAccess,
} from "@/lib/api-auth";

// GET /api/projects/:id/comments — list gantt tasks/comments (read for all roles)
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAccess("ganttComments", "read");
    const comments = await prisma.comment.findMany({
      where: { projectId: params.id },
      orderBy: { ganttStart: "asc" },
      include: { user: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ comments });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/projects/:id/comments — create (ADMIN, ENGINEER)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAccess("ganttComments", "write");
    const json = await req.json();
    const parsed = createCommentSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input"
      );
    }
    const { ganttStart, ganttEnd } = parsed.data;
    if (ganttEnd < ganttStart) {
      throw new HttpError(400, "End date must be after start date");
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!project) throw new HttpError(404, "Project not found");

    const comment = await prisma.comment.create({
      data: {
        projectId: params.id,
        userId: user.id,
        text: parsed.data.text,
        ganttStart,
        ganttEnd,
        progressPct: parsed.data.progressPct,
        discipline: parsed.data.discipline ?? null,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
