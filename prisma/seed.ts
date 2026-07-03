import {
  PrismaClient,
  Role,
  Discipline,
  ProposalStatus,
  ActivityType,
  TimesheetStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 12);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 5);
  return d;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "director@nepaeng.com.au";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  console.log("Seeding NepaEng platform (v2 — employee-centric timesheets)…\n");

  // ---- Users ---------------------------------------------------------------

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      department: "Management",
      team: "Executive",
      position: "Director",
      canApprove: true,
      canExportPdf: true,
      canUnlockApproved: true,
    },
    create: {
      name: "Peter Wilson",
      email: adminEmail,
      passwordHash: await hash(adminPassword),
      role: Role.ADMINISTRATOR,
      department: "Management",
      team: "Executive",
      position: "Director",
      canApprove: true,
      canExportPdf: true,
      canUnlockApproved: true,
    },
  });

  const seniorEng = await prisma.user.upsert({
    where: { email: "senior@nepaeng.com.au" },
    update: {
      department: "Engineering",
      team: "Fire & Hydraulics",
      position: "Senior Engineer",
      defaultApproverId: admin.id,
      canApprove: true,
      canExportPdf: true,
    },
    create: {
      name: "David Chen",
      email: "senior@nepaeng.com.au",
      passwordHash: await hash("Senior123!"),
      role: Role.SENIOR_ENGINEER,
      department: "Engineering",
      team: "Fire & Hydraulics",
      position: "Senior Engineer",
      defaultApproverId: admin.id,
      canApprove: true,
      canExportPdf: true,
    },
  });

  const engineer = await prisma.user.upsert({
    where: { email: "engineer@nepaeng.com.au" },
    update: {
      department: "Engineering",
      team: "Fire & Hydraulics",
      position: "Project Engineer",
      defaultApproverId: seniorEng.id,
      backupApproverId: admin.id,
      managerId: seniorEng.id,
    },
    create: {
      name: "Sam Engineer",
      email: "engineer@nepaeng.com.au",
      passwordHash: await hash("Engineer123!"),
      role: Role.ENGINEER,
      department: "Engineering",
      team: "Fire & Hydraulics",
      position: "Project Engineer",
      defaultApproverId: seniorEng.id,
      backupApproverId: admin.id,
      managerId: seniorEng.id,
    },
  });

  const engineer2 = await prisma.user.upsert({
    where: { email: "engineer2@nepaeng.com.au" },
    update: {
      department: "Engineering",
      team: "Mechanical",
      position: "Project Engineer",
      defaultApproverId: seniorEng.id,
      backupApproverId: admin.id,
      managerId: seniorEng.id,
    },
    create: {
      name: "Riya Hydraulics",
      email: "engineer2@nepaeng.com.au",
      passwordHash: await hash("Engineer123!"),
      role: Role.ENGINEER,
      department: "Engineering",
      team: "Mechanical",
      position: "Project Engineer",
      defaultApproverId: seniorEng.id,
      backupApproverId: admin.id,
      managerId: seniorEng.id,
    },
  });

  const bookkeeper = await prisma.user.upsert({
    where: { email: "accounts@nepaeng.com.au" },
    update: {
      department: "Finance",
      team: "Accounts",
      position: "Bookkeeper",
      defaultApproverId: admin.id,
      canExportPdf: true,
    },
    create: {
      name: "Pat Bookkeeper",
      email: "accounts@nepaeng.com.au",
      passwordHash: await hash("Accounts123!"),
      role: Role.BOOKKEEPER,
      department: "Finance",
      team: "Accounts",
      position: "Bookkeeper",
      defaultApproverId: admin.id,
      canExportPdf: true,
    },
  });

  // ---- Proposals -----------------------------------------------------------

  const wonProposal = await prisma.proposal.upsert({
    where: { proposalNumber: "PROP-2026-001" },
    update: {},
    create: {
      proposalNumber: "PROP-2026-001",
      projectName: "4 Bridge St — Fire & Hydraulic Upgrade",
      clientName: "John Strata",
      clientEmail: "john@bridgestrata.com.au",
      clientCompany: "Bridge St Strata Plan 12345",
      proposedFee: "18500.00",
      scope: [Discipline.FIRE, Discipline.HYDRAULICS],
      status: ProposalStatus.WON,
    },
  });

  await prisma.proposal.upsert({
    where: { proposalNumber: "PROP-2026-002" },
    update: {},
    create: {
      proposalNumber: "PROP-2026-002",
      projectName: "Maxwell St Penrith — Fire Detection Design",
      clientName: "Karen Facilities",
      clientEmail: "karen@penrithfm.com.au",
      clientCompany: "Penrith Facilities Group",
      proposedFee: "9750.00",
      scope: [Discipline.FIRE, Discipline.ELECTRICAL],
      status: ProposalStatus.PENDING,
    },
  });

  await prisma.proposal.upsert({
    where: { proposalNumber: "PROP-2026-003" },
    update: {},
    create: {
      proposalNumber: "PROP-2026-003",
      projectName: "Llandaff St Bondi — Mechanical Ventilation",
      clientName: "Tom Owner",
      clientEmail: "tom@bondiowners.com.au",
      proposedFee: "12250.00",
      scope: [Discipline.MECHANICAL],
      status: ProposalStatus.LOST,
    },
  });

  // ---- Projects ------------------------------------------------------------

  const project = await prisma.project.upsert({
    where: { projectNumber: "P-2601" },
    update: {},
    create: {
      projectNumber: "P-2601",
      projectName: "4 Bridge St — Fire & Hydraulic Upgrade",
      clientDetails: {
        name: "John Strata",
        email: "john@bridgestrata.com.au",
        phone: "+61 2 9000 0000",
        address: "4 Bridge St, Sydney NSW 2000",
        company: "Bridge St Strata Plan 12345",
        myobCustomerUid: null,
      },
      approvedFee: "18500.00",
      scopeOfWork: [Discipline.FIRE, Discipline.HYDRAULICS],
      isIssuedOut: false,
      proposalId: wonProposal.id,
      assignedEngineers: {
        connect: [{ id: engineer.id }, { id: engineer2.id }],
      },
    },
  });

  const project2 = await prisma.project.upsert({
    where: { projectNumber: "P-2602" },
    update: {},
    create: {
      projectNumber: "P-2602",
      projectName: "Whistler St Manly — Hydrant Block Plan",
      clientDetails: {
        name: "Manly Strata",
        email: "strata@manly.com.au",
        phone: "+61 2 9111 1111",
        address: "Whistler St, Manly NSW 2095",
        company: "",
        myobCustomerUid: null,
      },
      approvedFee: "7400.00",
      scopeOfWork: [Discipline.HYDRAULICS, Discipline.FIRE],
      isIssuedOut: false,
      assignedEngineers: { connect: [{ id: engineer.id }, { id: engineer2.id }] },
    },
  });

  // ---- Gantt comments / tasks ---------------------------------------------

  const today = new Date();
  const addDays = (d: number) => {
    const n = new Date(today);
    n.setDate(n.getDate() + d);
    return n;
  };

  const existingComments = await prisma.comment.count({
    where: { projectId: project.id },
  });
  if (existingComments === 0) {
    await prisma.comment.createMany({
      data: [
        {
          projectId: project.id,
          userId: engineer.id,
          text: "Site survey & fire services audit",
          ganttStart: addDays(0),
          ganttEnd: addDays(5),
          progressPct: 100,
          discipline: Discipline.FIRE,
        },
        {
          projectId: project.id,
          userId: engineer2.id,
          text: "Hydraulic services design & calcs",
          ganttStart: addDays(4),
          ganttEnd: addDays(14),
          progressPct: 45,
          discipline: Discipline.HYDRAULICS,
        },
        {
          projectId: project.id,
          userId: engineer.id,
          text: "Documentation & issue for construction",
          ganttStart: addDays(14),
          ganttEnd: addDays(21),
          progressPct: 0,
          discipline: Discipline.FIRE,
        },
      ],
    });
  }

  // ---- Timesheets (weekly module v2) --------------------------------------

  const existingTimesheets = await prisma.timesheetHeader.count();
  if (existingTimesheets === 0) {
    // --- Sam: SUBMITTED timesheet (last week) - pending approval by Senior Eng
    const lastWeekStart = getWeekStart(addDays(-7));
    const lastWeekEnd = getWeekEnd(lastWeekStart);

    const ts1 = await prisma.timesheetHeader.create({
      data: {
        employeeId: engineer.id,
        weekStart: lastWeekStart,
        weekEnd: lastWeekEnd,
        status: TimesheetStatus.SUBMITTED,
        totalHours: 42,
        weeklyComment: "Worked on commissioning activities across two sites. Completed QA review.",
        submittedDate: addDays(-2),
        createdBy: engineer.id,
        modifiedBy: engineer.id,
        lines: {
          create: [
            {
              projectId: project.id,
              activityType: ActivityType.PROJECT,
              sunday: 7, monday: 7, tuesday: 4, wednesday: 3, thursday: 0, friday: 0,
              totalHours: 21,
              lineComment: "Commissioning meeting and site inspection.",
              sortOrder: 0,
            },
            {
              projectId: project2.id,
              activityType: ActivityType.PROJECT,
              sunday: 0, monday: 0, tuesday: 3, wednesday: 4, thursday: 4, friday: 3,
              totalHours: 14,
              lineComment: "Block plan documentation and calcs review.",
              sortOrder: 1,
            },
            {
              projectId: null,
              activityType: ActivityType.OFFICE,
              sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 3, friday: 4,
              totalHours: 7,
              lineComment: null,
              sortOrder: 2,
            },
          ],
        },
      },
    });

    await prisma.approvalHistory.create({
      data: {
        timesheetId: ts1.id,
        status: TimesheetStatus.SUBMITTED,
        userId: engineer.id,
        actionDate: addDays(-2),
      },
    });

    // --- Sam: APPROVED timesheet (two weeks ago)
    const twoWeeksAgoStart = getWeekStart(addDays(-14));
    const twoWeeksAgoEnd = getWeekEnd(twoWeeksAgoStart);

    const ts2 = await prisma.timesheetHeader.create({
      data: {
        employeeId: engineer.id,
        weekStart: twoWeeksAgoStart,
        weekEnd: twoWeeksAgoEnd,
        status: TimesheetStatus.APPROVED,
        totalHours: 42,
        weeklyComment: "Full week on Bridge St fire upgrade.",
        approvalComment: "Good work, approved.",
        submittedDate: addDays(-9),
        approvedDate: addDays(-8),
        approvedById: seniorEng.id,
        createdBy: engineer.id,
        modifiedBy: seniorEng.id,
        lines: {
          create: [
            {
              projectId: project.id,
              activityType: ActivityType.PROJECT,
              sunday: 0, monday: 7, tuesday: 7, wednesday: 7, thursday: 7, friday: 7,
              totalHours: 35,
              lineComment: "Fire services design progression and coordination.",
              sortOrder: 0,
            },
            {
              projectId: null,
              activityType: ActivityType.OFFICE,
              sunday: 7, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0,
              totalHours: 7,
              lineComment: null,
              sortOrder: 1,
            },
          ],
        },
      },
    });

    await prisma.approvalHistory.createMany({
      data: [
        {
          timesheetId: ts2.id,
          status: TimesheetStatus.SUBMITTED,
          userId: engineer.id,
          actionDate: addDays(-9),
        },
        {
          timesheetId: ts2.id,
          status: TimesheetStatus.APPROVED,
          comment: "Good work, approved.",
          userId: seniorEng.id,
          actionDate: addDays(-8),
        },
      ],
    });

    // --- Riya: DRAFT timesheet (this week) — partially filled
    const thisWeekStart = getWeekStart(today);
    const thisWeekEnd = getWeekEnd(thisWeekStart);

    await prisma.timesheetHeader.create({
      data: {
        employeeId: engineer2.id,
        weekStart: thisWeekStart,
        weekEnd: thisWeekEnd,
        status: TimesheetStatus.DRAFT,
        totalHours: 21,
        weeklyComment: null,
        createdBy: engineer2.id,
        modifiedBy: engineer2.id,
        lines: {
          create: [
            {
              projectId: project.id,
              activityType: ActivityType.PROJECT,
              sunday: 0, monday: 3.5, tuesday: 3.5, wednesday: 3.5, thursday: 0, friday: 0,
              totalHours: 10.5,
              lineComment: "Hydraulic calcs and pump sizing.",
              sortOrder: 0,
            },
            {
              projectId: project2.id,
              activityType: ActivityType.PROJECT,
              sunday: 0, monday: 3.5, tuesday: 3.5, wednesday: 3.5, thursday: 0, friday: 0,
              totalHours: 10.5,
              lineComment: "Hydrant block plan drafting.",
              sortOrder: 1,
            },
          ],
        },
      },
    });

    // --- Senior Eng: SUBMITTED timesheet (last week) — pending admin approval
    const ts3 = await prisma.timesheetHeader.create({
      data: {
        employeeId: seniorEng.id,
        weekStart: lastWeekStart,
        weekEnd: lastWeekEnd,
        status: TimesheetStatus.SUBMITTED,
        totalHours: 42,
        weeklyComment: "Team management and design reviews. LNG project kickoff.",
        submittedDate: addDays(-1),
        createdBy: seniorEng.id,
        modifiedBy: seniorEng.id,
        lines: {
          create: [
            {
              projectId: project.id,
              activityType: ActivityType.PROJECT,
              sunday: 0, monday: 4, tuesday: 4, wednesday: 4, thursday: 4, friday: 4,
              totalHours: 20,
              lineComment: "Design review and team coordination.",
              sortOrder: 0,
            },
            {
              projectId: project2.id,
              activityType: ActivityType.PROJECT,
              sunday: 0, monday: 3, tuesday: 3, wednesday: 3, thursday: 3, friday: 3,
              totalHours: 15,
              lineComment: "Hydrant system review.",
              sortOrder: 1,
            },
            {
              projectId: null,
              activityType: ActivityType.ADMINISTRATION,
              sunday: 7, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0,
              totalHours: 7,
              lineComment: "Weekly reporting and team timesheets review.",
              sortOrder: 2,
            },
          ],
        },
      },
    });

    await prisma.approvalHistory.create({
      data: {
        timesheetId: ts3.id,
        status: TimesheetStatus.SUBMITTED,
        userId: seniorEng.id,
        actionDate: addDays(-1),
      },
    });

    console.log("  Timesheets seeded:");
    console.log("    Sam: 1 SUBMITTED (last week), 1 APPROVED (2 weeks ago)");
    console.log("    Riya: 1 DRAFT (this week, partially filled)");
    console.log("    David (Senior): 1 SUBMITTED (last week, pending admin approval)");
  }

  // ---- Print summary -------------------------------------------------------

  console.log("");
  console.log("Seed complete.");
  console.log("");
  console.log("Login credentials:");
  console.log(`  ADMINISTRATOR     ${admin.email} / ${adminPassword}`);
  console.log(`  SENIOR_ENGINEER   ${seniorEng.email} / Senior123!`);
  console.log(`  ENGINEER          ${engineer.email} / Engineer123!`);
  console.log(`  ENGINEER          ${engineer2.email} / Engineer123!`);
  console.log(`  BOOKKEEPER        ${bookkeeper.email} / Accounts123!`);
  console.log("");
  console.log("Approval hierarchy:");
  console.log("  Engineers (Sam, Riya) → David (Senior Engineer) → Peter (Administrator)");
  console.log("  David (Senior) → Peter (Administrator)");
  console.log("  Bookkeeper (Pat) → Peter (Administrator)");
  console.log("");
  console.log("Test scenarios:");
  console.log("  1. Login as David (Senior) → /timesheets/approvals → Review Sam's timesheet");
  console.log("  2. Login as Peter (Admin) → /timesheets/approvals → Review David's timesheet");
  console.log("  3. Login as Riya → /timesheets → Finish filling the draft, submit");
  console.log("  4. Login as Pat (Bookkeeper) → /timesheets/payroll → View approved, export CSV");
  console.log("  5. Login as Peter → /admin/users → Click Settings icon → Configure approvers");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
