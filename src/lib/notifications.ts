import "server-only";
import { prisma } from "@/lib/prisma";
import { formatWeekRange } from "@/lib/timesheet-utils";

/**
 * Email Notification Service — Stub Implementation
 *
 * This module provides the notification interface for the timesheet workflow.
 * In production, replace the `sendEmail` function with your email provider
 * (e.g. Resend, SendGrid, AWS SES, Nodemailer + SMTP).
 *
 * All notification functions are fire-and-forget (async, non-blocking).
 */

// ---- Email transport stub --------------------------------------------------

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Stub email sender. Logs to console in development.
 * Replace this function body with your actual email transport.
 */
async function sendEmail(payload: EmailPayload): Promise<void> {
  if (process.env.NODE_ENV === "development" || !process.env.SMTP_HOST) {
    console.log("[email-stub] Would send email:");
    console.log(`  To: ${payload.to}`);
    console.log(`  Subject: ${payload.subject}`);
    console.log(`  Body preview: ${payload.html.slice(0, 200)}...`);
    return;
  }

  // --- Production email implementation would go here ---
  // Example with nodemailer:
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail({
  //   from: process.env.EMAIL_FROM,
  //   to: payload.to,
  //   subject: payload.subject,
  //   html: payload.html,
  // });

  console.log(`[email] Sent to ${payload.to}: ${payload.subject}`);
}

// ---- Notification functions ------------------------------------------------

/**
 * Notify the manager that a timesheet has been submitted for approval.
 */
export async function sendTimesheetSubmittedNotification(params: {
  timesheetId: string;
  employeeName: string;
  managerId: string;
  weekStart: Date;
}): Promise<void> {
  const manager = await prisma.user.findUnique({
    where: { id: params.managerId },
    select: { email: true, name: true },
  });
  if (!manager) return;

  const weekRange = formatWeekRange(params.weekStart);
  const appUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  await sendEmail({
    to: manager.email,
    subject: `Timesheet Submitted — ${params.employeeName} (${weekRange})`,
    html: `
      <h2>Timesheet Submitted</h2>
      <p><strong>${params.employeeName}</strong> has submitted their timesheet for the week of <strong>${weekRange}</strong> and is awaiting your approval.</p>
      <p><a href="${appUrl}/timesheets/approvals">Review pending timesheets</a></p>
      <hr>
      <p style="color:#666;font-size:12px;">NepaEng Platform — Automated notification</p>
    `,
  });
}

/**
 * Notify the employee that their timesheet has been approved.
 */
export async function sendTimesheetApprovedNotification(params: {
  timesheetId: string;
  employeeId: string;
  employeeName: string;
  approverName: string;
  weekStart: Date;
}): Promise<void> {
  const employee = await prisma.user.findUnique({
    where: { id: params.employeeId },
    select: { email: true },
  });
  if (!employee) return;

  const weekRange = formatWeekRange(params.weekStart);
  const appUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  await sendEmail({
    to: employee.email,
    subject: `Timesheet Approved — ${weekRange}`,
    html: `
      <h2>Timesheet Approved</h2>
      <p>Your timesheet for the week of <strong>${weekRange}</strong> has been approved by <strong>${params.approverName}</strong>.</p>
      <p>The timesheet is now locked and recorded for payroll.</p>
      <p><a href="${appUrl}/timesheets">View your timesheets</a></p>
      <hr>
      <p style="color:#666;font-size:12px;">NepaEng Platform — Automated notification</p>
    `,
  });
}

/**
 * Notify the employee that their timesheet has been rejected, including
 * the manager's comment explaining why.
 */
export async function sendTimesheetRejectedNotification(params: {
  timesheetId: string;
  employeeId: string;
  employeeName: string;
  rejecterName: string;
  comment: string;
  weekStart: Date;
}): Promise<void> {
  const employee = await prisma.user.findUnique({
    where: { id: params.employeeId },
    select: { email: true },
  });
  if (!employee) return;

  const weekRange = formatWeekRange(params.weekStart);
  const appUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  await sendEmail({
    to: employee.email,
    subject: `Timesheet Rejected — ${weekRange}`,
    html: `
      <h2>Timesheet Rejected</h2>
      <p>Your timesheet for the week of <strong>${weekRange}</strong> has been rejected by <strong>${params.rejecterName}</strong>.</p>
      <blockquote style="border-left:3px solid #e53e3e;padding-left:12px;color:#444;">
        ${params.comment}
      </blockquote>
      <p>Please update your timesheet and resubmit.</p>
      <p><a href="${appUrl}/timesheets">Edit your timesheet</a></p>
      <hr>
      <p style="color:#666;font-size:12px;">NepaEng Platform — Automated notification</p>
    `,
  });
}
