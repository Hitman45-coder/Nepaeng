import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead, canWrite } from "@/lib/rbac";
import { decToNum } from "@/lib/serialize";
import { ProjectDetailClient } from "./project-detail-client";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      assignedEngineers: { select: { id: true, name: true } },
      proposal: { select: { id: true, proposalNumber: true } },
      comments: {
        orderBy: { ganttStart: "asc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!project) notFound();

  const showFinancials = canRead(session.role, "financials");

  // Engineer roster for the assignment editor (ADMIN only).
  const engineers =
    session.role === "ADMINISTRATOR"
      ? await prisma.user.findMany({
          where: { role: "ENGINEER", isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  const cd = (project.clientDetails ?? {}) as Record<string, unknown>;

  return (
    <ProjectDetailClient
      session={{ id: session.id, role: session.role }}
      permissions={{
        canEditScope: canWrite(session.role, "projectScope"),
        canEditFinancials: canWrite(session.role, "financials"),
        canComment: canWrite(session.role, "ganttComments"),
        showFinancials,
      }}
      engineers={engineers}
      project={{
        id: project.id,
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        clientDetails: {
          name: (cd.name as string) ?? "",
          email: (cd.email as string) ?? "",
          phone: (cd.phone as string) ?? "",
          address: (cd.address as string) ?? "",
          company: (cd.company as string) ?? "",
          myobCustomerUid: (cd.myobCustomerUid as string | null) ?? null,
        },
        scopeOfWork: project.scopeOfWork,
        assignedEngineers: project.assignedEngineers,
        isIssuedOut: project.isIssuedOut,
        proposal: project.proposal,
        approvedFee: showFinancials ? decToNum(project.approvedFee) ?? 0 : null,
        myobInvoiceNumber: project.myobInvoiceNumber,
        myobInvoiceUid: project.myobInvoiceUid,
        isInvoiced: project.isInvoiced,
        isPaid: project.isPaid,
      }}
      comments={project.comments.map((c) => ({
        id: c.id,
        text: c.text,
        ganttStart: c.ganttStart.toISOString(),
        ganttEnd: c.ganttEnd.toISOString(),
        progressPct: c.progressPct,
        discipline: c.discipline,
        userId: c.userId,
        userName: c.user.name,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
