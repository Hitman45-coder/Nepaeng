import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { errorResponse, requireAccess } from "@/lib/api-auth";
import { getAuthorizeUrl } from "@/lib/myob";

export const dynamic = "force-dynamic";

// GET /api/myob/authorize — kick off the MYOB OAuth2 flow.
export async function GET() {
  try {
    await requireAccess("financials", "write");
    const state = randomBytes(16).toString("hex");
    cookies().set("myob_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return NextResponse.redirect(getAuthorizeUrl(state));
  } catch (err) {
    return errorResponse(err);
  }
}
