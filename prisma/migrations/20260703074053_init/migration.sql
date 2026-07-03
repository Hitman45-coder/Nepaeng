-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMINISTRATOR', 'SENIOR_ENGINEER', 'ENGINEER', 'BOOKKEEPER');

-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('FIRE', 'MECHANICAL', 'HYDRAULICS', 'ELECTRICAL', 'STORMWATER');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_REVISION', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('PROJECT', 'ANNUAL_LEAVE', 'MEDICAL_LEAVE', 'TRAINING', 'PUBLIC_HOLIDAY', 'OFFICE', 'ADMINISTRATION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustResetPassword" BOOLEAN NOT NULL DEFAULT false,
    "department" TEXT,
    "team" TEXT,
    "position" TEXT,
    "defaultApproverId" TEXT,
    "backupApproverId" TEXT,
    "managerId" TEXT,
    "timesheetEnabled" BOOLEAN NOT NULL DEFAULT true,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canExportPdf" BOOLEAN NOT NULL DEFAULT false,
    "canUnlockApproved" BOOLEAN NOT NULL DEFAULT false,
    "maxWeeklyHours" DECIMAL(4,1) NOT NULL DEFAULT 42,
    "expectedDailyHours" DECIMAL(3,1) NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "proposalNumber" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientCompany" TEXT,
    "proposedFee" DECIMAL(12,2) NOT NULL,
    "scope" "Discipline"[],
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "clientDetails" JSONB NOT NULL,
    "approvedFee" DECIMAL(12,2) NOT NULL,
    "scopeOfWork" "Discipline"[],
    "isIssuedOut" BOOLEAN NOT NULL DEFAULT false,
    "myobInvoiceNumber" TEXT,
    "myobInvoiceUid" TEXT,
    "isInvoiced" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "proposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ganttStart" TIMESTAMP(3) NOT NULL,
    "ganttEnd" TIMESTAMP(3) NOT NULL,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "discipline" "Discipline",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetHeader" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalHours" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "weeklyComment" TEXT,
    "submittedDate" TIMESTAMP(3),
    "approvedDate" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvalComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "modifiedAt" TIMESTAMP(3) NOT NULL,
    "modifiedBy" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "TimesheetHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetLine" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "projectId" TEXT,
    "activityType" "ActivityType" NOT NULL DEFAULT 'PROJECT',
    "sunday" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "monday" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "tuesday" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "wednesday" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "thursday" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "friday" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "totalHours" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "lineComment" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TimesheetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "status" "TimesheetStatus" NOT NULL,
    "comment" TEXT,
    "userId" TEXT NOT NULL,
    "actionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MyobSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "companyFileId" TEXT NOT NULL,
    "companyFileUri" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MyobSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AssignedEngineers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- CreateIndex
CREATE INDEX "User_defaultApproverId_idx" ON "User"("defaultApproverId");

-- CreateIndex
CREATE INDEX "User_department_idx" ON "User"("department");

-- CreateIndex
CREATE INDEX "User_team_idx" ON "User"("team");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_proposalNumber_key" ON "Proposal"("proposalNumber");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectNumber_key" ON "Project"("projectNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Project_proposalId_key" ON "Project"("proposalId");

-- CreateIndex
CREATE INDEX "Project_isIssuedOut_idx" ON "Project"("isIssuedOut");

-- CreateIndex
CREATE INDEX "Project_isInvoiced_idx" ON "Project"("isInvoiced");

-- CreateIndex
CREATE INDEX "Project_isPaid_idx" ON "Project"("isPaid");

-- CreateIndex
CREATE INDEX "Comment_projectId_idx" ON "Comment"("projectId");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "TimesheetHeader_status_idx" ON "TimesheetHeader"("status");

-- CreateIndex
CREATE INDEX "TimesheetHeader_employeeId_idx" ON "TimesheetHeader"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetHeader_weekStart_idx" ON "TimesheetHeader"("weekStart");

-- CreateIndex
CREATE INDEX "TimesheetHeader_approvedById_idx" ON "TimesheetHeader"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetHeader_employeeId_weekStart_key" ON "TimesheetHeader"("employeeId", "weekStart");

-- CreateIndex
CREATE INDEX "TimesheetLine_timesheetId_idx" ON "TimesheetLine"("timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetLine_projectId_idx" ON "TimesheetLine"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetLine_timesheetId_projectId_activityType_key" ON "TimesheetLine"("timesheetId", "projectId", "activityType");

-- CreateIndex
CREATE INDEX "ApprovalHistory_timesheetId_idx" ON "ApprovalHistory"("timesheetId");

-- CreateIndex
CREATE INDEX "ApprovalHistory_userId_idx" ON "ApprovalHistory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "_AssignedEngineers_AB_unique" ON "_AssignedEngineers"("A", "B");

-- CreateIndex
CREATE INDEX "_AssignedEngineers_B_index" ON "_AssignedEngineers"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultApproverId_fkey" FOREIGN KEY ("defaultApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_backupApproverId_fkey" FOREIGN KEY ("backupApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetHeader" ADD CONSTRAINT "TimesheetHeader_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetHeader" ADD CONSTRAINT "TimesheetHeader_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetLine" ADD CONSTRAINT "TimesheetLine_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "TimesheetHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetLine" ADD CONSTRAINT "TimesheetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "TimesheetHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssignedEngineers" ADD CONSTRAINT "_AssignedEngineers_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssignedEngineers" ADD CONSTRAINT "_AssignedEngineers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
