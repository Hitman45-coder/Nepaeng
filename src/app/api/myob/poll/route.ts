import { NextResponse } from "next/server";
import { errorResponse, requireAccess } from "@/lib/api-auth";
import { pollMyobPayments } from "@/lib/cron";

export const dynamic = "force-dynamic";

// POST /api/myob/poll — manually trigger a payment-status poll run.
export async function POST() {
  try {
    await requireAccess("financials", "write");
    const result = await pollMyobPayments();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
