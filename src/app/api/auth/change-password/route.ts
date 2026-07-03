import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validation";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const json = await req.json();
    const parsed = changePasswordSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input"
      );
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) throw new HttpError(404, "User not found");

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new HttpError(400, "Current password is incorrect");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustResetPassword: false,
      },
    });

    // Re-issue the session so mustResetPassword is cleared in the cookie.
    await createSession({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      mustResetPassword: false,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
