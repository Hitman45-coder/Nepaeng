import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { updateUserSchema } from "@/lib/validation";
import { errorResponse, HttpError, requireAccess } from "@/lib/api-auth";
import { generateTempPassword } from "@/lib/utils";

// PATCH /api/users/:id — update role / name / active status
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAccess("userManagement", "write");
    const json = await req.json();
    const parsed = updateUserSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid input");
    }

    // Guard: an admin cannot deactivate or demote themselves (avoids lockout).
    if (params.id === admin.id) {
      if (parsed.data.isActive === false || parsed.data.role) {
        throw new HttpError(
          400,
          "You cannot change your own role or active status"
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/users/:id (action=reset-password) — issue a new temp password
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAccess("userManagement", "write");
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "reset-password") {
      throw new HttpError(400, "Unsupported action");
    }
    const tempPassword = generateTempPassword();
    await prisma.user.update({
      where: { id: params.id },
      data: {
        passwordHash: await hashPassword(tempPassword),
        mustResetPassword: true,
      },
    });
    return NextResponse.json({ tempPassword });
  } catch (err) {
    return errorResponse(err);
  }
}
