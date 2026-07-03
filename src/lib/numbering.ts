import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Generate the next proposal number for the current year, e.g. PROP-2026-001.
 */
export async function nextProposalNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;
  const last = await prisma.proposal.findFirst({
    where: { proposalNumber: { startsWith: prefix } },
    orderBy: { proposalNumber: "desc" },
    select: { proposalNumber: true },
  });
  const lastSeq = last ? parseInt(last.proposalNumber.slice(prefix.length), 10) : 0;
  const seq = String(lastSeq + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

/**
 * Generate the next project number, e.g. P-2601 (P-<YY><seq>).
 * Uses the last two digits of the year + a 2-digit running sequence.
 */
export async function nextProjectNumber(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `P-${yy}`;
  const last = await prisma.project.findFirst({
    where: { projectNumber: { startsWith: prefix } },
    orderBy: { projectNumber: "desc" },
    select: { projectNumber: true },
  });
  const lastSeq = last ? parseInt(last.projectNumber.slice(prefix.length), 10) : 0;
  const seq = String(lastSeq + 1).padStart(2, "0");
  return `${prefix}${seq}`;
}
