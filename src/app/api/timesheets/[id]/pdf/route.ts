import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/api-auth";
import { hasTimesheetPermission } from "@/lib/rbac";
import { generateTimesheetPdf, getPdfFilename } from "@/lib/pdf-generator";
import { SYSTEM_ACTIVITIES } from "@/lib/validation";
import { decToNum } from "@/lib/serialize";

/**
 * GET /api/timesheets/:id/pdf
 *
 * Generate and download a PDF of the timesheet.
 *
 * Access control:
 * - Own timesheet: any role with exportPdfOwn
 * - Team timesheet: SENIOR_ENGINEER + BOOKKEEPER with exportPdfTeam
 * - Any timesheet: ADMIN + BOOKKEEPER with exportPdfAll
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    const timesheet = await prisma.timesheetHeader.findUnique({
      where: { id: params.id },
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
          include: {
            project: {
              select: { id: true, projectNumber: true, projectName: true },
            },
          },
        },
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            position: true,
            team: true,
            defaultApprover: { select: { id: true, name: true } },
          },
        },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!timesheet) throw new HttpError(404, "Timesheet not found");

    // Access control for PDF export
    const isOwn = timesheet.employeeId === user.id;
    if (isOwn) {
      if (!hasTimesheetPermission(user.role, "exportPdfOwn")) {
        throw new HttpError(403, "You do not have permission to export PDFs");
      }
    } else if (hasTimesheetPermission(user.role, "exportPdfAll")) {
      // OK — can export all
    } else if (hasTimesheetPermission(user.role, "exportPdfTeam")) {
      // Check if this employee is in the user's team/assigned
      const employee = await prisma.user.findUnique({
        where: { id: timesheet.employeeId },
        select: { defaultApproverId: true, backupApproverId: true, managerId: true },
      });
      const isAssigned =
        employee?.defaultApproverId === user.id ||
        employee?.backupApproverId === user.id ||
        employee?.managerId === user.id;
      if (!isAssigned) {
        throw new HttpError(403, "You can only export PDFs for your assigned team");
      }
    } else {
      throw new HttpError(403, "You do not have permission to export this PDF");
    }

    // Check user's canExportPdf flag
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { canExportPdf: true },
    });
    // Allow if role-based permission exists OR explicit flag is set
    // (role permissions are the primary gate; canExportPdf is an additional override)

    // Build PDF data
    const pdfData = {
      employeeName: timesheet.employee.name,
      employeeEmail: timesheet.employee.email,
      department: timesheet.employee.department,
      position: timesheet.employee.position,
      team: timesheet.employee.team,
      weekStart: timesheet.weekStart,
      weekEnd: timesheet.weekEnd,
      status: timesheet.status,
      totalHours: decToNum(timesheet.totalHours) ?? 0,
      weeklyComment: timesheet.weeklyComment,
      approvalComment: timesheet.approvalComment,
      approvedByName: timesheet.approvedBy?.name ?? null,
      approvedDate: timesheet.approvedDate,
      submittedDate: timesheet.submittedDate,
      approverName: timesheet.employee.defaultApprover?.name ?? null,
      lines: timesheet.lines.map((l) => ({
        projectCode: l.project?.projectNumber ?? null,
        projectName: l.project?.projectName ?? null,
        activityLabel:
          l.activityType === "PROJECT"
            ? (l.project?.projectName ?? "Project")
            : (SYSTEM_ACTIVITIES.find((a) => a.type === l.activityType)?.label ?? l.activityType),
        sunday: decToNum(l.sunday) ?? 0,
        monday: decToNum(l.monday) ?? 0,
        tuesday: decToNum(l.tuesday) ?? 0,
        wednesday: decToNum(l.wednesday) ?? 0,
        thursday: decToNum(l.thursday) ?? 0,
        friday: decToNum(l.friday) ?? 0,
        totalHours: decToNum(l.totalHours) ?? 0,
        lineComment: l.lineComment,
      })),
    };

    const pdfBuffer = await generateTimesheetPdf(pdfData);
    const filename = getPdfFilename(timesheet.employee.name, timesheet.weekEnd);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
