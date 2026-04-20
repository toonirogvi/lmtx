export type UserRole = "Admin" | "HR" | "Advocate";

export type InternStatus = "Applied" | "Offered" | "Joined" | "Completed" | "Relieved";

export type DocumentType = "offer" | "certificate" | "experience" | "relieving" | "nda";

export type ApplicantStatus = "Applied" | "Screening" | "Interview" | "Offered" | "Hired" | "Rejected";

export type UserRecord = {
  id: string;
  name?: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  organization?: string;
  barCouncilId?: string;
  creditBalance?: number;
  freeCaseUsed?: boolean;
  freeCaseExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InternRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  joiningDate: Date;
  exitDate: Date | null;
  duration: string;
  manager: string;
  referenceId: string;
  status: InternStatus;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type ApplicantRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  source: string;
  status: ApplicantStatus;
  experience: string;
  expectedJoiningDate: Date | null;
  resumeUrl?: string;
  owner: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type DocumentRecord = {
  id: string;
  internId: string;
  type: DocumentType;
  fileUrl: string;
  createdAt: Date;
};

export type ActivityLogRecord = {
  id: string;
  actorId?: string;
  internId?: string;
  entity: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

export type AdvocateCaseStatus = "Open" | "In Review" | "Closed";

export type AdvocateCaseRecord = {
  id: string;
  advocateId: string;
  caseTitle: string;
  clientName: string;
  caseType: string;
  jurisdiction?: string;
  description: string;
  status: AdvocateCaseStatus;
  creditSource: "Free Trial" | "Paid Credit";
  createdAt: Date;
  updatedAt: Date;
};

export type CreditTransactionStatus = "Completed" | "Pending Approval" | "Rejected";

export type CreditTransactionRecord = {
  id: string;
  advocateId: string;
  type: "FREE_CASE_GRANTED" | "FREE_CASE_USED" | "PURCHASE_REQUESTED" | "PURCHASE_APPROVED" | "CASE_CREDIT_USED" | "ADMIN_ADJUSTMENT";
  credits: number;
  status: CreditTransactionStatus;
  packageId?: string;
  amountInr?: number;
  caseId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
