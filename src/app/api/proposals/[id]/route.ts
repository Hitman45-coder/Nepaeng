import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateProposalSchema } from "@/lib/validation";
import { errorResponse, HttpError, requireAccess } from "@/lib/api-auth";

// PATCH /api/proposals/:id — update fields / status (ADMIN only)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAccess("proposals", "write");
    const json = await req.json();
    const parsed = updateProposalSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid input");
    }
    const proposal = await prisma.proposal.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        clientCompany:
          parsed.data.clientCompany === undefined
            ? undefined
            : parsed.data.clientCompany ?? null,
      },
    });
    return NextResponse.json({ proposal });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/proposals/:id (ADMIN only)
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAccess("proposals", "write");
    const proposal = await prisma.proposal.findUnique({
      where: { id: params.id },
      include: { convertedProject: true },
    });
    if (!proposal) throw new HttpError(404, "Proposal not found");
    if (proposal.convertedProject) {
      throw new HttpError(
        400,
        "Cannot delete a proposal that has been converted to a project"
      );
    }
    await prisma.proposal.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
