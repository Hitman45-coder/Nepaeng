import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead } from "@/lib/rbac";
import { MyobSettingsClient } from "./myob-client";

export const dynamic = "force-dynamic";

export default async function MyobSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canRead(session.role, "financials")) redirect("/403");

  const settings = await prisma.myobSettings.findUnique({
    where: { id: 1 },
    select: { companyFileId: true, expiresAt: true, updatedAt: true },
  });

  const unpaidInvoiced = await prisma.project.count({
    where: { isInvoiced: true, isPaid: false },
  });

  return (
    <MyobSettingsClient
      connected={!!settings}
      companyFileId={settings?.companyFileId ?? null}
      expiresAt={settings?.expiresAt?.toISOString() ?? null}
      updatedAt={settings?.updatedAt?.toISOString() ?? null}
      unpaidInvoiced={unpaidInvoiced}
    />
  );
}
