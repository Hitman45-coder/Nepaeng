import { NextResponse } from "next/server";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAccess } from "@/lib/api-auth";
import { nextProjectNumber } from "@/lib/numbering";

/**
 * POST /api/proposals/:id/convert
 * Convert a WON (or pending) proposal into a Project. Marks the proposal WON
 * and links the new project via the 1:1 relation. Idempotent-ish: refuses if
 * already converted.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAccess("proposals", "write");

    const proposal = await prisma.proposal.findUnique({
      where: { id: params.id },
      include: { convertedProject: { select: { id: true } } },
    });
    if (!proposal) throw new HttpError(404, "Proposal not found");
    if (proposal.convertedProject) {
      throw new HttpError(409, "Proposal already converted to a project");
    }

    const projectNumber = await nextProjectNumber();

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          projectNumber,
          projectName: proposal.projectName,
          clientDetails: {
            name: proposal.clientName,
            email: proposal.clientEmail,
            phone: "",
            address: "",
            company: proposal.clientCompany ?? "",
            myobCustomerUid: null,
          },
          approvedFee: proposal.proposedFee,
          scopeOfWork: proposal.scope,
          proposalId: proposal.id,
        },
        select: { id: true, projectNumber: true },
      });
      await tx.proposal.update({
        where: { id: proposal.id },
        data: { status: ProposalStatus.WON },
      });
      return created;
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
