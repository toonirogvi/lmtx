import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type {
  ActivityLogRecord,
  ApplicantRecord,
  ApplicantStatus,
  AdvocateCaseRecord,
  CreditTransactionRecord,
  DocumentRecord,
  DocumentType,
  InternRecord,
  InternStatus,
  UserRecord,
  UserRole
} from "../types/models";

type LocalDb = {
  users: UserRecord[];
  interns: InternRecord[];
  applicants: ApplicantRecord[];
  documents: DocumentRecord[];
  activityLogs: ActivityLogRecord[];
  advocateCases: AdvocateCaseRecord[];
  creditTransactions: CreditTransactionRecord[];
  referenceCounters: Record<string, number>;
};

const dbPath = path.resolve(process.cwd(), "../storage/local-dev-db.json");
let queue = Promise.resolve();

const emptyDb = (): LocalDb => ({
  users: [],
  interns: [],
  applicants: [],
  documents: [],
  activityLogs: [],
  advocateCases: [],
  creditTransactions: [],
  referenceCounters: {}
});

function serializeRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])
  );
}

function reviveDb(raw: LocalDb): LocalDb {
  return {
    users: raw.users.map((user) => ({
      ...user,
      freeCaseExpiresAt: user.freeCaseExpiresAt ? new Date(user.freeCaseExpiresAt) : null,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt)
    })),
    interns: raw.interns.map((intern) => ({
      ...intern,
      joiningDate: new Date(intern.joiningDate),
      exitDate: intern.exitDate ? new Date(intern.exitDate) : null,
      createdAt: new Date(intern.createdAt),
      updatedAt: new Date(intern.updatedAt),
      deletedAt: intern.deletedAt ? new Date(intern.deletedAt) : null
    })),
    applicants: (raw.applicants ?? []).map((applicant) => ({
      ...applicant,
      expectedJoiningDate: applicant.expectedJoiningDate ? new Date(applicant.expectedJoiningDate) : null,
      createdAt: new Date(applicant.createdAt),
      updatedAt: new Date(applicant.updatedAt),
      deletedAt: applicant.deletedAt ? new Date(applicant.deletedAt) : null
    })),
    documents: raw.documents.map((document) => ({
      ...document,
      createdAt: new Date(document.createdAt)
    })),
    activityLogs: raw.activityLogs.map((activity) => ({
      ...activity,
      createdAt: new Date(activity.createdAt)
    })),
    advocateCases: (raw.advocateCases ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt)
    })),
    creditTransactions: (raw.creditTransactions ?? []).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt)
    })),
    referenceCounters: raw.referenceCounters ?? {}
  };
}

async function readDb() {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    return reviveDb(JSON.parse(raw) as LocalDb);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyDb();
    }
    throw error;
  }
}

async function writeDb(db: LocalDb) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(
    dbPath,
    JSON.stringify(
      {
        users: db.users.map(serializeRecord),
        interns: db.interns.map(serializeRecord),
        applicants: db.applicants.map(serializeRecord),
        documents: db.documents.map(serializeRecord),
        activityLogs: db.activityLogs.map(serializeRecord),
        advocateCases: db.advocateCases.map(serializeRecord),
        creditTransactions: db.creditTransactions.map(serializeRecord),
        referenceCounters: db.referenceCounters
      },
      null,
      2
    )
  );
}

async function mutateDb<T>(mutator: (db: LocalDb) => Promise<T> | T) {
  const run = async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  };

  const result = queue.then(run, run);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function matchesSearch(intern: InternRecord, search?: string) {
  if (!search) return true;
  const needle = search.trim().toLowerCase();

  return [intern.name, intern.email, intern.referenceId, intern.role, intern.department, intern.manager].some((value) =>
    value.toLowerCase().includes(needle)
  );
}

function matchesApplicantSearch(applicant: ApplicantRecord, search?: string) {
  if (!search) return true;
  const needle = search.trim().toLowerCase();

  return [
    applicant.name,
    applicant.email,
    applicant.phone,
    applicant.position,
    applicant.department,
    applicant.source,
    applicant.owner,
    applicant.notes ?? ""
  ].some((value) => value.toLowerCase().includes(needle));
}

export async function localGetUserByEmail(email: string) {
  const db = await readDb();
  return db.users.find((user) => user.email === email) ?? null;
}

export async function localGetUserById(id: string) {
  const db = await readDb();
  return db.users.find((user) => user.id === id) ?? null;
}

export async function localUpsertUser(input: {
  id?: string;
  email: string;
  password?: string;
  role: UserRole;
  name?: string;
  phone?: string;
  organization?: string;
  barCouncilId?: string;
  creditBalance?: number;
  freeCaseUsed?: boolean;
  freeCaseExpiresAt?: Date | null;
}) {
  return mutateDb((db) => {
    const now = new Date();
    const existing = db.users.find((user) => user.email === input.email);

    if (existing) {
      existing.password = input.password ?? existing.password;
      existing.role = input.role;
      existing.name = input.name ?? existing.name;
      existing.phone = input.phone ?? existing.phone;
      existing.organization = input.organization ?? existing.organization;
      existing.barCouncilId = input.barCouncilId ?? existing.barCouncilId;
      existing.creditBalance = input.creditBalance ?? existing.creditBalance ?? 0;
      existing.freeCaseUsed = input.freeCaseUsed ?? existing.freeCaseUsed ?? false;
      existing.freeCaseExpiresAt = input.freeCaseExpiresAt ?? existing.freeCaseExpiresAt ?? null;
      existing.updatedAt = now;
      return existing;
    }

    const user: UserRecord = {
      id: input.id ?? randomUUID(),
      email: input.email,
      password: input.password,
      role: input.role,
      name: input.name,
      phone: input.phone,
      organization: input.organization,
      barCouncilId: input.barCouncilId,
      creditBalance: input.creditBalance ?? 0,
      freeCaseUsed: input.freeCaseUsed ?? false,
      freeCaseExpiresAt: input.freeCaseExpiresAt ?? null,
      createdAt: now,
      updatedAt: now
    };
    db.users.push(user);
    return user;
  });
}

export async function localCreateInternRecord(input: Omit<InternRecord, "id" | "createdAt" | "updatedAt" | "deletedAt" | "isRevoked">) {
  return mutateDb((db) => {
    const now = new Date();
    const intern: InternRecord = {
      ...input,
      id: randomUUID(),
      isRevoked: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    db.interns.push(intern);
    return intern;
  });
}

export async function localListInternRecords(input: {
  search?: string;
  status?: InternStatus;
  includeDeleted?: boolean;
  page: number;
  limit: number;
}) {
  const db = await readDb();
  const all = db.interns
    .filter((intern) => (input.includeDeleted ? true : !intern.deletedAt))
    .filter((intern) => (input.status ? intern.status === input.status : true))
    .filter((intern) => matchesSearch(intern, input.search))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    total: all.length,
    data: all.slice((input.page - 1) * input.limit, input.page * input.limit)
  };
}

export async function localGetInternById(id: string) {
  const db = await readDb();
  return db.interns.find((intern) => intern.id === id) ?? null;
}

export async function localGetInternByReferenceId(referenceId: string) {
  const db = await readDb();
  return db.interns.find((intern) => intern.referenceId === referenceId) ?? null;
}

export async function localUpdateInternRecord(id: string, input: Partial<Omit<InternRecord, "id" | "createdAt" | "updatedAt">>) {
  return mutateDb((db) => {
    const intern = db.interns.find((item) => item.id === id);
    if (!intern) {
      throw new Error("Record not found.");
    }

    Object.assign(intern, input, { updatedAt: new Date() });
    return intern;
  });
}

export async function localCreateApplicantRecord(
  input: Omit<ApplicantRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">
) {
  return mutateDb((db) => {
    const now = new Date();
    const applicant: ApplicantRecord = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    db.applicants.push(applicant);
    return applicant;
  });
}

export async function localListApplicantRecords(input: {
  search?: string;
  status?: ApplicantStatus;
  includeDeleted?: boolean;
  page: number;
  limit: number;
}) {
  const db = await readDb();
  const all = db.applicants
    .filter((applicant) => (input.includeDeleted ? true : !applicant.deletedAt))
    .filter((applicant) => (input.status ? applicant.status === input.status : true))
    .filter((applicant) => matchesApplicantSearch(applicant, input.search))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    total: all.length,
    data: all.slice((input.page - 1) * input.limit, input.page * input.limit)
  };
}

export async function localGetApplicantById(id: string) {
  const db = await readDb();
  return db.applicants.find((applicant) => applicant.id === id) ?? null;
}

export async function localUpdateApplicantRecord(
  id: string,
  input: Partial<Omit<ApplicantRecord, "id" | "createdAt" | "updatedAt">>
) {
  return mutateDb((db) => {
    const applicant = db.applicants.find((item) => item.id === id);
    if (!applicant) {
      throw new Error("Applicant not found.");
    }

    Object.assign(applicant, input, { updatedAt: new Date() });
    return applicant;
  });
}

export async function localListDocumentsByInternId(internId: string) {
  const db = await readDb();
  return db.documents
    .filter((document) => document.internId === internId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function localListActivityByInternId(internId: string, limit = 30) {
  const db = await readDb();
  return db.activityLogs
    .filter((activity) => activity.internId === internId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function localListActivityRecords(input: {
  actions?: string[];
  page: number;
  limit: number;
}) {
  const db = await readDb();
  const all = db.activityLogs
    .filter((activity) => (input.actions ? input.actions.includes(activity.action) : true))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    total: all.length,
    data: all.slice((input.page - 1) * input.limit, input.page * input.limit)
  };
}

export async function localCreateDocumentRecord(input: { internId: string; type: DocumentType; fileUrl: string }) {
  return mutateDb((db) => {
    const document: DocumentRecord = {
      id: randomUUID(),
      internId: input.internId,
      type: input.type,
      fileUrl: input.fileUrl,
      createdAt: new Date()
    };
    db.documents.push(document);
    return document;
  });
}

export async function localListDocumentRecords(internId?: string) {
  const db = await readDb();
  return db.documents
    .filter((document) => (internId ? document.internId === internId : true))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function localGetDocumentById(id: string) {
  const db = await readDb();
  return db.documents.find((document) => document.id === id) ?? null;
}

export async function localCreateActivityLog(input: {
  actorId?: string;
  internId?: string;
  entity: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  return mutateDb((db) => {
    const activity: ActivityLogRecord = {
      id: randomUUID(),
      createdAt: new Date(),
      ...input
    };
    db.activityLogs.push(activity);
    return activity;
  });
}

export async function localCreateAdvocateCase(input: Omit<AdvocateCaseRecord, "id" | "createdAt" | "updatedAt">) {
  return mutateDb((db) => {
    const now = new Date();
    const record: AdvocateCaseRecord = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    db.advocateCases.push(record);
    return record;
  });
}

export async function localListAdvocateCases(advocateId: string) {
  const db = await readDb();
  return db.advocateCases
    .filter((item) => item.advocateId === advocateId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function localCreateCreditTransaction(input: Omit<CreditTransactionRecord, "id" | "createdAt">) {
  return mutateDb((db) => {
    const record: CreditTransactionRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date()
    };
    db.creditTransactions.push(record);
    return record;
  });
}

export async function localListCreditTransactions(advocateId?: string) {
  const db = await readDb();
  return db.creditTransactions
    .filter((item) => (advocateId ? item.advocateId === advocateId : true))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function localUpdateCreditTransactionStatus(
  id: string,
  input: { status: CreditTransactionRecord["status"]; metadata?: Record<string, unknown> }
) {
  return mutateDb((db) => {
    const transaction = db.creditTransactions.find((item) => item.id === id);
    if (!transaction) {
      throw new Error("Credit transaction not found.");
    }
    transaction.status = input.status;
    transaction.metadata = {
      ...(transaction.metadata ?? {}),
      ...(input.metadata ?? {})
    };
    return transaction;
  });
}

export async function localUpdateAdvocateCredits(
  advocateId: string,
  input: { creditBalance?: number; freeCaseUsed?: boolean; freeCaseExpiresAt?: Date | null }
) {
  return mutateDb((db) => {
    const user = db.users.find((item) => item.id === advocateId);
    if (!user) {
      throw new Error("Advocate not found.");
    }
    Object.assign(user, input, { updatedAt: new Date() });
    return user;
  });
}

export async function localGenerateReferenceSerial(day: string) {
  return mutateDb((db) => {
    const next = (db.referenceCounters[day] ?? 0) + 1;
    db.referenceCounters[day] = next;
    return next;
  });
}

export async function localDbHealth() {
  await readDb();
  return { status: "ok", driver: "local-dev-db", path: dbPath };
}
