import "server-only";
import { prisma } from "@/lib/prisma";
import type { MyobSettings } from "@prisma/client";

/**
 * Minimal MYOB Business / AccountRight API client.
 *
 * Implements the OAuth2 authorization-code flow plus the handful of endpoints
 * the platform needs: create a Sale Invoice and read invoice payment status.
 *
 * Docs: https://developer.myob.com/api/myob-business-api/
 *
 * NOTE: A single company-file token set is stored in the MyobSettings row
 * (id = 1). Tokens are refreshed transparently on demand.
 */

const OAUTH_BASE = "https://secure.myob.com/oauth2";
const API_BASE = "https://api.myob.com/accountright";

export interface MyobTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
  scope?: string;
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required MYOB env var: ${name}`);
  return v;
}

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requiredEnv("MYOB_CLIENT_ID"),
    redirect_uri: requiredEnv("MYOB_REDIRECT_URI"),
    response_type: "code",
    scope: "CompanyFile",
    state,
  });
  return `${OAUTH_BASE}/account/authorize?${params.toString()}`;
}

async function postToken(body: Record<string, string>): Promise<MyobTokenResponse> {
  const res = await fetch(`${OAUTH_BASE}/v1/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MYOB token request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as MyobTokenResponse;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<MyobTokenResponse> {
  return postToken({
    client_id: requiredEnv("MYOB_CLIENT_ID"),
    client_secret: requiredEnv("MYOB_CLIENT_SECRET"),
    scope: "CompanyFile",
    code,
    redirect_uri: requiredEnv("MYOB_REDIRECT_URI"),
    grant_type: "authorization_code",
  });
}

export async function refreshTokens(
  refreshToken: string
): Promise<MyobTokenResponse> {
  return postToken({
    client_id: requiredEnv("MYOB_CLIENT_ID"),
    client_secret: requiredEnv("MYOB_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

export async function persistTokens(
  tokens: MyobTokenResponse,
  opts: { companyFileId?: string; companyFileUri?: string } = {}
): Promise<MyobSettings> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  return prisma.myobSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      companyFileId: opts.companyFileId ?? "",
      companyFileUri: opts.companyFileUri,
      expiresAt,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      ...(opts.companyFileId ? { companyFileId: opts.companyFileId } : {}),
      ...(opts.companyFileUri ? { companyFileUri: opts.companyFileUri } : {}),
      expiresAt,
    },
  });
}

/** Returns a valid access token, refreshing it if it is close to expiry. */
export async function getValidSettings(): Promise<MyobSettings | null> {
  const settings = await prisma.myobSettings.findUnique({ where: { id: 1 } });
  if (!settings) return null;

  // Refresh if expiring within 2 minutes.
  if (settings.expiresAt.getTime() - Date.now() < 2 * 60 * 1000) {
    const refreshed = await refreshTokens(settings.refreshToken);
    return persistTokens(refreshed, {
      companyFileId: settings.companyFileId,
      companyFileUri: settings.companyFileUri ?? undefined,
    });
  }
  return settings;
}

function apiHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "x-myobapi-key": requiredEnv("MYOB_API_KEY"),
    "x-myobapi-version": "v2",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export interface MyobInvoiceResult {
  uid: string;
  number: string;
  isPaid: boolean;
  status: string;
  balanceDueAmount: number;
  totalAmount: number;
}

/** Fetch the company files visible to the authenticated user. */
export async function listCompanyFiles(): Promise<
  Array<{ Id: string; Name: string; Uri: string }>
> {
  const settings = await getValidSettings();
  if (!settings) throw new Error("MYOB not connected");
  const res = await fetch(API_BASE, {
    headers: apiHeaders(settings.accessToken),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`MYOB company file list failed: ${res.status}`);
  return (await res.json()) as Array<{ Id: string; Name: string; Uri: string }>;
}

/**
 * Create a service Sale Invoice for a project in MYOB.
 * Returns the created invoice UID + number.
 */
export async function createServiceInvoice(input: {
  customerUid: string;
  description: string;
  totalExGst: number;
  jobNumber?: string;
}): Promise<{ uid: string; number: string }> {
  const settings = await getValidSettings();
  if (!settings) throw new Error("MYOB not connected");
  const cf = settings.companyFileUri ?? `${API_BASE}/${settings.companyFileId}`;

  const body = {
    Customer: { UID: input.customerUid },
    Lines: [
      {
        Type: "Transaction",
        Description: input.description,
        Total: input.totalExGst,
      },
    ],
    IsTaxInclusive: false,
    JournalMemo: input.jobNumber ? `Project ${input.jobNumber}` : undefined,
  };

  const res = await fetch(`${cf}/Sale/Invoice/Service`, {
    method: "POST",
    headers: apiHeaders(settings.accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MYOB create invoice failed (${res.status}): ${text}`);
  }
  // MYOB returns the new resource location; the UID is the last path segment.
  const location = res.headers.get("Location") ?? "";
  const uid = location.split("/").pop() ?? "";

  // Read back to obtain the human invoice number.
  const created = await getInvoiceStatus(uid).catch(() => null);
  return { uid, number: created?.number ?? "" };
}

/** Read an invoice's current payment status from MYOB. */
export async function getInvoiceStatus(uid: string): Promise<MyobInvoiceResult> {
  const settings = await getValidSettings();
  if (!settings) throw new Error("MYOB not connected");
  const cf = settings.companyFileUri ?? `${API_BASE}/${settings.companyFileId}`;

  const res = await fetch(`${cf}/Sale/Invoice/Service/${uid}`, {
    headers: apiHeaders(settings.accessToken),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MYOB read invoice failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    UID: string;
    Number: string;
    Status: string;
    BalanceDueAmount: number;
    TotalAmount: number;
  };
  return {
    uid: data.UID,
    number: data.Number,
    status: data.Status,
    balanceDueAmount: data.BalanceDueAmount,
    totalAmount: data.TotalAmount,
    isPaid: data.Status === "Closed" || data.BalanceDueAmount === 0,
  };
}
