import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { errorResponse, HttpError } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = loginSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(400, "Email and password are required");
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Constant-ish failure path to avoid leaking which emails exist.
    if (!user || !user.isActive) {
      throw new HttpError(401, "Invalid email or password");
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new HttpError(401, "Invalid email or password");
    }

    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
    });

    return NextResponse.json({
      ok: true,
      mustResetPassword: user.mustResetPassword,
      role: user.role,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
