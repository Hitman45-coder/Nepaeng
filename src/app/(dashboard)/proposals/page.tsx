import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decToNum } from "@/lib/serialize";
import { ProposalsClient } from "./proposals-client";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMINISTRATOR") redirect("/403");

  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      convertedProject: { select: { id: true, projectNumber: true } },
    },
  });

  return (
    <ProposalsClient
      initialProposals={proposals.map((p) => ({
        id: p.id,
        proposalNumber: p.proposalNumber,
        projectName: p.projectName,
        clientName: p.clientName,
        clientEmail: p.clientEmail,
        clientCompany: p.clientCompany,
        proposedFee: decToNum(p.proposedFee) ?? 0,
        scope: p.scope,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        convertedProject: p.convertedProject,
      }))}
    />
  );
}
