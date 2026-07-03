import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateCommentSchema } from "@/lib/validation";
import {
  errorResponse,
  HttpError,
  requireAccess,
} from "@/lib/api-auth";

// PATCH /api/comments/:id — update a gantt task/comment (ADMIN, ENGINEER)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAccess("ganttComments", "write");
    const json = await req.json();
    const parsed = updateCommentSchema.safeParse(json);
    if (!parsed.success) throw new HttpError(400, "Invalid input");

    const existing = await prisma.comment.findUnique({
      where: { id: params.id },
      select: { userId: true },
    });
    if (!existing) throw new HttpError(404, "Comment not found");

    // Engineers may only edit their own comments; admins can edit any.
    if (user.role === "ENGINEER" && existing.userId !== user.id) {
      throw new HttpError(403, "You can only edit your own entries");
    }

    const d = parsed.data;
    if (d.ganttStart && d.ganttEnd && d.ganttEnd < d.ganttStart) {
      throw new HttpError(400, "End date must be after start date");
    }

    const comment = await prisma.comment.update({
      where: { id: params.id },
      data: {
        ...(d.text !== undefined ? { text: d.text } : {}),
        ...(d.ganttStart !== undefined ? { ganttStart: d.ganttStart } : {}),
        ...(d.ganttEnd !== undefined ? { ganttEnd: d.ganttEnd } : {}),
        ...(d.progressPct !== undefined ? { progressPct: d.progressPct } : {}),
        ...(d.discipline !== undefined ? { discipline: d.discipline ?? null } : {}),
      },
      include: { user: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ comment });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/comments/:id
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAccess("ganttComments", "write");
    const existing = await prisma.comment.findUnique({
      where: { id: params.id },
      select: { userId: true },
    });
    if (!existing) throw new HttpError(404, "Comment not found");
    if (user.role === "ENGINEER" && existing.userId !== user.id) {
      throw new HttpError(403, "You can only delete your own entries");
    }
    await prisma.comment.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
