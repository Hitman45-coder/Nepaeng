import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  updateProjectScopeSchema,
  updateProjectFinancialsSchema,
} from "@/lib/validation";
import {
  errorResponse,
  HttpError,
  requireUser,
} from "@/lib/api-auth";
import { canWrite } from "@/lib/rbac";

// GET /api/projects/:id
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireUser();
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        assignedEngineers: { select: { id: true, name: true } },
        proposal: { select: { id: true, proposalNumber: true } },
      },
    });
    if (!project) throw new HttpError(404, "Project not found");
    return NextResponse.json({ project });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH /api/projects/:id
 *
 * Splits the payload into scope fields and financial fields and enforces
 * per-section RBAC:
 *  - scope/assignment/issue status -> requires write on "projectScope"
 *    (ADMIN, ENGINEER)
 *  - financials (fee, invoice flags) -> requires write on "financials"
 *    (ADMIN, BOOKKEEPER)
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const data: Prisma.ProjectUpdateInput = {};

    // ---- Scope section -----------------------------------------------------
    const scopeKeys = [
      "projectName",
      "clientDetails",
      "scopeOfWork",
      "assignedEngineerIds",
      "isIssuedOut",
    ];
    const hasScope = scopeKeys.some((k) => k in body);
    if (hasScope) {
      if (!canWrite(user.role, "projectScope")) {
        throw new HttpError(403, "Forbidden: cannot edit project scope");
      }
      const parsed = updateProjectScopeSchema.safeParse(body);
      if (!parsed.success) throw new HttpError(400, "Invalid scope input");
      const d = parsed.data;
      if (d.projectName !== undefined) data.projectName = d.projectName;
      if (d.scopeOfWork !== undefined) data.scopeOfWork = d.scopeOfWork;
      if (d.isIssuedOut !== undefined) data.isIssuedOut = d.isIssuedOut;
      if (d.clientDetails !== undefined) {
        data.clientDetails = {
          ...d.clientDetails,
          myobCustomerUid: d.clientDetails.myobCustomerUid ?? null,
        };
      }
      if (d.assignedEngineerIds !== undefined) {
        data.assignedEngineers = {
          set: d.assignedEngineerIds.map((id) => ({ id })),
        };
      }
    }

    // ---- Financial section -------------------------------------------------
    const finKeys = [
      "approvedFee",
      "myobInvoiceNumber",
      "myobInvoiceUid",
      "isInvoiced",
      "isPaid",
    ];
    const hasFin = finKeys.some((k) => k in body);
    if (hasFin) {
      if (!canWrite(user.role, "financials")) {
        throw new HttpError(403, "Forbidden: cannot edit financials");
      }
      const parsed = updateProjectFinancialsSchema.safeParse(body);
      if (!parsed.success) throw new HttpError(400, "Invalid financial input");
      const d = parsed.data;
      if (d.approvedFee !== undefined) data.approvedFee = d.approvedFee;
      if (d.myobInvoiceNumber !== undefined)
        data.myobInvoiceNumber = d.myobInvoiceNumber ?? null;
      if (d.myobInvoiceUid !== undefined)
        data.myobInvoiceUid = d.myobInvoiceUid ?? null;
      if (d.isInvoiced !== undefined) data.isInvoiced = d.isInvoiced;
      if (d.isPaid !== undefined) data.isPaid = d.isPaid;
    }

    if (!hasScope && !hasFin) {
      throw new HttpError(400, "No editable fields supplied");
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data,
      include: { assignedEngineers: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ project });
  } catch (err) {
    return errorResponse(err);
  }
}
