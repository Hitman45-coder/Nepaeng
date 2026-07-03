import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAccess } from "@/lib/api-auth";
import { createServiceInvoice, getInvoiceStatus } from "@/lib/myob";
import { decToNum } from "@/lib/serialize";

/**
 * POST /api/projects/:id/invoice
 *
 * action="create" — raise a MYOB service invoice for the project's approved
 *                   fee and persist the invoice UID/number; sets isInvoiced.
 * action="sync"   — read the invoice's current payment status from MYOB and
 *                   update isPaid accordingly.
 *
 * Requires write access to financials (ADMINISTRATOR, BOOKKEEPER).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAccess("financials", "write");
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    const project = await prisma.project.findUnique({
      where: { id: params.id },
    });
    if (!project) throw new HttpError(404, "Project not found");

    // ---- Create -----------------------------------------------------------
    if (action === "create") {
      if (project.isInvoiced) {
        throw new HttpError(409, "Project is already invoiced");
      }
      const cd = (project.clientDetails ?? {}) as Record<string, unknown>;
      const customerUid =
        (body?.myobCustomerUid as string | undefined) ||
        (cd.myobCustomerUid as string | undefined);
      if (!customerUid) {
        throw new HttpError(400, "A MYOB customer UID is required");
      }

      const fee = decToNum(project.approvedFee) ?? 0;
      const { uid, number } = await createServiceInvoice({
        customerUid,
        description: `${project.projectNumber} — ${project.projectName}`,
        totalExGst: fee,
        jobNumber: project.projectNumber,
      });

      // Persist invoice details + the customer UID back onto clientDetails.
      const updated = await prisma.project.update({
        where: { id: project.id },
        data: {
          myobInvoiceUid: uid,
          myobInvoiceNumber: number || null,
          isInvoiced: true,
          clientDetails: { ...cd, myobCustomerUid: customerUid },
        },
      });
      return NextResponse.json({
        ok: true,
        invoiceNumber: updated.myobInvoiceNumber,
        invoiceUid: updated.myobInvoiceUid,
      });
    }

    // ---- Sync -------------------------------------------------------------
    if (action === "sync") {
      if (!project.myobInvoiceUid) {
        throw new HttpError(400, "Project has no linked MYOB invoice");
      }
      const status = await getInvoiceStatus(project.myobInvoiceUid);
      const updated = await prisma.project.update({
        where: { id: project.id },
        data: {
          isPaid: status.isPaid,
          myobInvoiceNumber: status.number || project.myobInvoiceNumber,
        },
      });
      return NextResponse.json({
        ok: true,
        isPaid: updated.isPaid,
        balanceDue: status.balanceDueAmount,
      });
    }

    throw new HttpError(400, "Unsupported action");
  } catch (err) {
    return errorResponse(err);
  }
}
