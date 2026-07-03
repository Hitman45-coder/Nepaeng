import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "@prisma/client";

/**
 * Edge-safe session primitives.
 *
 * This module only uses `jose`, so it is safe to import from both the Edge
 * middleware and Node route handlers. It must NOT import bcryptjs, `server-only`,
 * `next/headers`, or anything that depends on the Node.js runtime.
 */

export const SESSION_COOKIE = "nepaeng_session";

const TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 28800); // 8h

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustResetPassword: boolean;
}

interface SessionPayload extends JWTPayload {
  sub: string;
  name: string;
  email: string;
  role: Role;
  mustResetPassword: boolean;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Set it in .env");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
    mustResetPassword: user.mustResetPassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySession(
  token: string | undefined | null
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecretKey());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      mustResetPassword: Boolean(payload.mustResetPassword),
    };
  } catch {
    return null;
  }
}

export const SESSION_TTL_SECONDS = TTL_SECONDS;
