import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createProposalSchema } from "@/lib/validation";
import { errorResponse, HttpError, requireAccess } from "@/lib/api-auth";
import { nextProposalNumber } from "@/lib/numbering";

// GET /api/proposals — list (ADMIN only)
export async function GET() {
  try {
    await requireAccess("proposals", "read");
    const proposals = await prisma.proposal.findMany({
      orderBy: { createdAt: "desc" },
      include: { convertedProject: { select: { id: true, projectNumber: true } } },
    });
    return NextResponse.json({ proposals });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/proposals — create (ADMIN only)
export async function POST(req: Request) {
  try {
    await requireAccess("proposals", "write");
    const json = await req.json();
    const parsed = createProposalSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input"
      );
    }
    const proposal = await prisma.proposal.create({
      data: {
        proposalNumber: await nextProposalNumber(),
        projectName: parsed.data.projectName,
        clientName: parsed.data.clientName,
        clientEmail: parsed.data.clientEmail,
        clientCompany: parsed.data.clientCompany ?? null,
        proposedFee: parsed.data.proposedFee,
        scope: parsed.data.scope,
      },
    });
    return NextResponse.json({ proposal }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
