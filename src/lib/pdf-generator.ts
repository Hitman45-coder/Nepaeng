import "server-only";
import PDFDocument from "pdfkit";
import { TIMESHEET_CONSTANTS, SYSTEM_ACTIVITIES } from "@/lib/validation";
import { formatWeekRange, toDateOnly } from "@/lib/timesheet-utils";

const DAYS = TIMESHEET_CONSTANTS.DAYS;
const DAY_LABELS = TIMESHEET_CONSTANTS.DAY_LABELS;

interface PdfLineData {
  projectCode: string | null;
  projectName: string | null;
  activityLabel: string;
  sunday: number;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  totalHours: number;
  lineComment: string | null;
}

interface PdfTimesheetData {
  employeeName: string;
  employeeEmail: string;
  department: string | null;
  position: string | null;
  team: string | null;
  weekStart: Date;
  weekEnd: Date;
  status: string;
  totalHours: number;
  weeklyComment: string | null;
  approvalComment: string | null;
  approvedByName: string | null;
  approvedDate: Date | null;
  submittedDate: Date | null;
  approverName: string | null;
  lines: PdfLineData[];
}

/**
 * Generate a PDF buffer for a timesheet.
 *
 * Uses PDFKit to create a professional timesheet document with:
 * - Company header
 * - Employee details
 * - Weekly hours grid
 * - Project comments
 * - Weekly comment
 * - Approval info
 * - Footer with generated date/page number
 */
export async function generateTimesheetPdf(
  data: PdfTimesheetData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: `Timesheet - ${data.employeeName} - ${toDateOnly(data.weekEnd)}`,
        Author: "NepaEng Platform",
        Subject: "Employee Timesheet",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 80; // margins
    const colWidths = {
      project: 160,
      day: 48,
      total: 52,
    };

    // ---- Header ----
    doc.fontSize(18).font("Helvetica-Bold").text("NepaEng", 40, 40);
    doc.fontSize(8).font("Helvetica").text("Engineering Consultancy", 40, 62);
    doc.fontSize(14).font("Helvetica-Bold").text("TIMESHEET", 40, 90);
    doc.moveTo(40, 110).lineTo(40 + pageWidth, 110).stroke();

    // ---- Employee Details ----
    let y = 120;
    doc.fontSize(9).font("Helvetica");

    const detailLeft = [
      ["Employee:", data.employeeName],
      ["Department:", data.department ?? "—"],
      ["Position:", data.position ?? "—"],
    ];
    const detailRight = [
      ["Week:", formatWeekRange(data.weekStart)],
      ["Status:", data.status],
      ["Approver:", data.approverName ?? "—"],
    ];

    for (let i = 0; i < detailLeft.length; i++) {
      doc.font("Helvetica-Bold").text(detailLeft[i][0], 40, y + i * 14, { continued: true });
      doc.font("Helvetica").text(` ${detailLeft[i][1]}`);
    }
    for (let i = 0; i < detailRight.length; i++) {
      doc.font("Helvetica-Bold").text(detailRight[i][0], 320, 120 + i * 14, { continued: true });
      doc.font("Helvetica").text(` ${detailRight[i][1]}`);
    }

    y = 170;
    doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke();

    // ---- Timesheet Grid ----
    y += 10;

    // Header row
    doc.fontSize(8).font("Helvetica-Bold");
    let x = 40;
    doc.text("Project / Activity", x, y, { width: colWidths.project });
    x += colWidths.project;
    for (const label of DAY_LABELS) {
      doc.text(label, x, y, { width: colWidths.day, align: "center" });
      x += colWidths.day;
    }
    doc.text("Total", x, y, { width: colWidths.total, align: "center" });

    y += 14;
    doc.moveTo(40, y).lineTo(40 + pageWidth, y).lineWidth(0.5).stroke();

    // Data rows
    doc.font("Helvetica").fontSize(8);
    for (const line of data.lines) {
      y += 4;
      x = 40;

      // Project/Activity name
      const label = line.projectCode
        ? `${line.projectCode} - ${line.projectName ?? ""}`
        : line.activityLabel;
      doc.text(label.slice(0, 35), x, y, { width: colWidths.project });
      x += colWidths.project;

      // Daily hours
      const hours = [line.sunday, line.monday, line.tuesday, line.wednesday, line.thursday, line.friday];
      for (const h of hours) {
        doc.text(h > 0 ? String(h) : "—", x, y, { width: colWidths.day, align: "center" });
        x += colWidths.day;
      }
      // Row total
      doc.font("Helvetica-Bold").text(String(line.totalHours), x, y, { width: colWidths.total, align: "center" });
      doc.font("Helvetica");

      y += 12;

      // Line comment
      if (line.lineComment) {
        doc.fontSize(7).fillColor("#666666")
          .text(`"${line.lineComment}"`, 50, y, { width: colWidths.project + 40 });
        doc.fillColor("#000000").fontSize(8);
        y += 10;
      }

      // Separator
      doc.moveTo(40, y).lineTo(40 + pageWidth, y).lineWidth(0.25).stroke();
    }

    // Totals row
    y += 6;
    doc.font("Helvetica-Bold").fontSize(9);
    x = 40;
    doc.text("Weekly Total", x, y, { width: colWidths.project });
    x += colWidths.project;

    // Daily totals
    for (const day of DAYS) {
      const dayTotal = data.lines.reduce((s, l) => s + l[day], 0);
      doc.text(dayTotal > 0 ? String(Math.round(dayTotal * 10) / 10) : "—", x, y, { width: colWidths.day, align: "center" });
      x += colWidths.day;
    }
    doc.fontSize(11).text(String(data.totalHours), x, y - 1, { width: colWidths.total, align: "center" });

    y += 20;
    doc.moveTo(40, y).lineTo(40 + pageWidth, y).lineWidth(0.5).stroke();

    // ---- Comments Section ----
    y += 12;
    if (data.weeklyComment) {
      doc.fontSize(9).font("Helvetica-Bold").text("Employee Weekly Comment:", 40, y);
      y += 12;
      doc.font("Helvetica").fontSize(8).text(data.weeklyComment, 40, y, { width: pageWidth });
      y += doc.heightOfString(data.weeklyComment, { width: pageWidth }) + 10;
    }

    if (data.approvalComment) {
      doc.fontSize(9).font("Helvetica-Bold").text("Approval Comment:", 40, y);
      y += 12;
      doc.font("Helvetica").fontSize(8).text(data.approvalComment, 40, y, { width: pageWidth });
      y += doc.heightOfString(data.approvalComment, { width: pageWidth }) + 10;
    }

    // ---- Approval Signature Block ----
    if (data.approvedByName && data.approvedDate) {
      y += 10;
      doc.moveTo(40, y).lineTo(40 + pageWidth, y).lineWidth(0.25).stroke();
      y += 8;
      doc.fontSize(9).font("Helvetica-Bold").text("Approved By:", 40, y, { continued: true });
      doc.font("Helvetica").text(` ${data.approvedByName}`);
      y += 14;
      doc.font("Helvetica-Bold").text("Approval Date:", 40, y, { continued: true });
      doc.font("Helvetica").text(` ${data.approvedDate.toLocaleDateString("en-AU")}`);
    }

    // ---- Footer ----
    const footerY = doc.page.height - 50;
    doc.fontSize(7).font("Helvetica").fillColor("#999999");
    doc.text(
      `Generated: ${new Date().toLocaleString("en-AU")} | NepaEng Platform | Page 1`,
      40,
      footerY,
      { width: pageWidth, align: "center" }
    );

    doc.end();
  });
}

/**
 * Generate the PDF filename per spec: Timesheet_EmployeeName_YYYY-MM-DD.pdf
 */
export function getPdfFilename(employeeName: string, weekEnd: Date): string {
  const safeName = employeeName.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "");
  return `Timesheet_${safeName}_${toDateOnly(weekEnd)}.pdf`;
}
