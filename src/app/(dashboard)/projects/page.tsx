import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead } from "@/lib/rbac";
import { decToNum } from "@/lib/serialize";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const showFinancials = canRead(session.role, "financials");
  const canCreate = session.role === "ADMINISTRATOR";

  // Engineers list is only needed (and permitted) for the admin create flow.
  const [projects, engineers] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { assignedEngineers: { select: { id: true, name: true } } },
    }),
    canCreate
      ? prisma.user.findMany({
          where: { role: "ENGINEER", isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  return (
    <ProjectsClient
      showFinancials={showFinancials}
      canCreate={canCreate}
      engineers={engineers}
      initialProjects={projects.map((p) => {
        const cd = (p.clientDetails ?? {}) as Record<string, unknown>;
        return {
          id: p.id,
          projectNumber: p.projectNumber,
          projectName: p.projectName,
          clientName: (cd.name as string) ?? "",
          scopeOfWork: p.scopeOfWork,
          assignedEngineers: p.assignedEngineers,
          isIssuedOut: p.isIssuedOut,
          approvedFee: decToNum(p.approvedFee) ?? 0,
          isInvoiced: p.isInvoiced,
          isPaid: p.isPaid,
        };
      })}
    />
  );
}
