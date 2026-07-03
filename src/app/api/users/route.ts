import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createUserSchema } from "@/lib/validation";
import { errorResponse, HttpError, requireAccess } from "@/lib/api-auth";
import { generateTempPassword } from "@/lib/utils";

// GET /api/users — list users (ADMIN only)
export async function GET() {
  try {
    await requireAccess("userManagement", "read");
    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustResetPassword: true,
        createdAt: true,
        _count: { select: { projects: true, timesheets: true } },
      },
    });
    return NextResponse.json({ users });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/users — create a user with a generated temporary password
export async function POST(req: Request) {
  try {
    await requireAccess("userManagement", "write");
    const json = await req.json();
    const parsed = createUserSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid input"
      );
    }
    const { name, email, role } = parsed.data;
    const normEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normEmail },
    });
    if (existing) throw new HttpError(409, "A user with that email exists");

    const tempPassword = generateTempPassword();
    const user = await prisma.user.create({
      data: {
        name,
        email: normEmail,
        role,
        passwordHash: await hashPassword(tempPassword),
        mustResetPassword: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    // The temporary password is returned ONCE so the admin can relay it.
    return NextResponse.json({ user, tempPassword }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
