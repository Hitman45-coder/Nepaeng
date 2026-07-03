import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, requireAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/myob/status — connection status for the settings page.
export async function GET() {
  try {
    await requireAccess("financials", "read");
    const settings = await prisma.myobSettings.findUnique({
      where: { id: 1 },
      select: { companyFileId: true, expiresAt: true, updatedAt: true },
    });
    return NextResponse.json({
      connected: !!settings,
      companyFileId: settings?.companyFileId ?? null,
      expiresAt: settings?.expiresAt ?? null,
      updatedAt: settings?.updatedAt ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
