import type { Discipline, Role } from "@prisma/client";

export interface ProjectClientDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  myobCustomerUid: string | null;
}

export interface ProjectDetail {
  id: string;
  projectNumber: string;
  projectName: string;
  clientDetails: ProjectClientDetails;
  scopeOfWork: Discipline[];
  assignedEngineers: { id: string; name: string }[];
  isIssuedOut: boolean;
  proposal: { id: string; proposalNumber: string } | null;
  approvedFee: number | null;
  myobInvoiceNumber: string | null;
  myobInvoiceUid: string | null;
  isInvoiced: boolean;
  isPaid: boolean;
}

export interface CommentDetail {
  id: string;
  text: string;
  ganttStart: string;
  ganttEnd: string;
  progressPct: number;
  discipline: Discipline | null;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface Permissions {
  canEditScope: boolean;
  canEditFinancials: boolean;
  canComment: boolean;
  showFinancials: boolean;
}

export interface SessionInfo {
  id: string;
  role: Role;
}
