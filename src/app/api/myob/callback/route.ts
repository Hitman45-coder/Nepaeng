import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { errorResponse, requireAccess } from "@/lib/api-auth";
import {
  exchangeCodeForTokens,
  persistTokens,
  listCompanyFiles,
} from "@/lib/myob";

export const dynamic = "force-dynamic";

/**
 * GET /api/myob/callback?code=...&state=...
 * Completes the OAuth2 flow: validates state, exchanges the code for tokens,
 * resolves the (first) company file, and persists everything to MyobSettings.
 */
export async function GET(req: Request) {
  try {
    await requireAccess("financials", "write");
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const expectedState = cookies().get("myob_oauth_state")?.value;

    const base = process.env.APP_BASE_URL ?? new URL(req.url).origin;

    if (!code) {
      return NextResponse.redirect(`${base}/settings/myob?error=missing_code`);
    }
    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(`${base}/settings/myob?error=bad_state`);
    }

    const tokens = await exchangeCodeForTokens(code);
    // Persist tokens first so listCompanyFiles can authenticate.
    await persistTokens(tokens);

    // Resolve the company file (use the first one available).
    let companyFileId = "";
    let companyFileUri: string | undefined;
    try {
      const files = await listCompanyFiles();
      if (files[0]) {
        companyFileId = files[0].Id;
        companyFileUri = files[0].Uri;
      }
    } catch {
      // Company file resolution can be completed later from the settings page.
    }
    await persistTokens(tokens, { companyFileId, companyFileUri });

    cookies().delete("myob_oauth_state");
    return NextResponse.redirect(`${base}/settings/myob?connected=1`);
  } catch (err) {
    return errorResponse(err);
  }
}
