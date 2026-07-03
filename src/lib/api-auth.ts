import "server-only";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession, type SessionUser } from "@/lib/auth";
import { accessFor, type Resource, type Access } from "@/lib/rbac";

/** Thrown to short-circuit a handler with a specific HTTP response. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("Unhandled API error:", err);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

/** Require an authenticated user or throw 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, "Not authenticated");
  return user;
}

/** Require one of the given roles or throw 403. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new HttpError(403, "Forbidden: insufficient role");
  }
  return user;
}

const RANK: Record<Access, number> = { none: 0, read: 1, write: 2 };

/** Require at least `minimum` access to `resource` or throw 401/403. */
export async function requireAccess(
  resource: Resource,
  minimum: Exclude<Access, "none"> = "read"
): Promise<SessionUser> {
  const user = await requireUser();
  const granted = accessFor(user.role, resource);
  if (RANK[granted] < RANK[minimum]) {
    throw new HttpError(403, `Forbidden: cannot ${minimum} ${resource}`);
  }
  return user;
}
