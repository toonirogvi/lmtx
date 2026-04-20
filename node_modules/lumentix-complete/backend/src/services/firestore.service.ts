import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { env } from "../config/env";
import { firestore } from "../config/firebase";
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
import { AppError } from "../utils/errors";
import {
  localCreateActivityLog,
  localCreateApplicantRecord,
  localCreateAdvocateCase,
  localCreateCreditTransaction,
  localCreateDocumentRecord,
  localCreateInternRecord,
  localDbHealth,
  localGetDocumentById,
  localGetApplicantById,
  localGetInternById,
  localGetInternByReferenceId,
  localGetUserById,
  localGetUserByEmail,
  localListAdvocateCases,
  localListApplicantRecords,
  localListActivityRecords,
  localListActivityByInternId,
  localListCreditTransactions,
  localListDocumentRecords,
  localListDocumentsByInternId,
  localListInternRecords,
  localUpdateCreditTransactionStatus,
  localUpdateApplicantRecord,
  localUpdateInternRecord,
  localUpdateAdvocateCredits,
  localUpsertUser
} from "./localDb.service";

type FirestoreDate = Date | Timestamp | string | null | undefined;

export const collections = {
  users: firestore.collection("users"),
  interns: firestore.collection("interns"),
  applicants: firestore.collection("applicants"),
  documents: firestore.collection("documents"),
  activityLogs: firestore.collection("activityLogs"),
  advocateCases: firestore.collection("advocateCases"),
  creditTransactions: firestore.collection("creditTransactions"),
  referenceCounters: firestore.collection("referenceCounters")
};

function withFirestoreTimeout<T>(promise: Promise<T>, timeoutMs = 7000) {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => {
        reject(
          new AppError(
            "Firestore is not reachable. Start the Firestore emulator or configure Firebase Admin credentials.",
            503
          )
        );
      }, timeoutMs);
    })
  ]);
}

function asDate(value: FirestoreDate, fallback = new Date()) {
  if (!value) return fallback;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  return new Date(value);
}

function asNullableDate(value: FirestoreDate) {
  if (!value) return null;
  return asDate(value);
}

function toTimestamp(value: Date) {
  return Timestamp.fromDate(value);
}

function matchesSearch(intern: InternRecord, search?: string) {
  if (!search) return true;
  const needle = search.trim().toLowerCase();

  return [
    intern.name,
    intern.email,
    intern.referenceId,
    intern.role,
    intern.department,
    intern.manager
  ].some((value) => value.toLowerCase().includes(needle));
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

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function internFromDoc(doc: FirebaseFirestore.DocumentSnapshot): InternRecord {
  const data = doc.data();
  if (!data) {
    throw new Error(`Intern document ${doc.id} has no data.`);
  }

  return {
    id: doc.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    department: data.department,
    joiningDate: asDate(data.joiningDate),
    exitDate: asNullableDate(data.exitDate),
    duration: data.duration,
    manager: data.manager,
    referenceId: data.referenceId,
    status: data.status,
    isRevoked: Boolean(data.isRevoked),
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    deletedAt: asNullableDate(data.deletedAt)
  };
}

function applicantFromDoc(doc: FirebaseFirestore.DocumentSnapshot): ApplicantRecord {
  const data = doc.data();
  if (!data) {
    throw new Error(`Applicant document ${doc.id} has no data.`);
  }

  return {
    id: doc.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    position: data.position,
    department: data.department,
    source: data.source,
    status: data.status,
    experience: data.experience,
    expectedJoiningDate: asNullableDate(data.expectedJoiningDate),
    resumeUrl: data.resumeUrl,
    owner: data.owner,
    notes: data.notes,
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    deletedAt: asNullableDate(data.deletedAt)
  };
}

function documentFromDoc(doc: FirebaseFirestore.DocumentSnapshot): DocumentRecord {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} has no data.`);
  }

  return {
    id: doc.id,
    internId: data.internId,
    type: data.type,
    fileUrl: data.fileUrl,
    createdAt: asDate(data.createdAt)
  };
}

function activityFromDoc(doc: FirebaseFirestore.DocumentSnapshot): ActivityLogRecord {
  const data = doc.data();
  if (!data) {
    throw new Error(`Activity log ${doc.id} has no data.`);
  }

  return {
    id: doc.id,
    actorId: data.actorId,
    internId: data.internId,
    entity: data.entity,
    entityId: data.entityId,
    action: data.action,
    metadata: data.metadata,
    createdAt: asDate(data.createdAt)
  };
}

function userFromDoc(doc: FirebaseFirestore.DocumentSnapshot): UserRecord {
  const data = doc.data();
  if (!data) {
    throw new Error(`User ${doc.id} has no data.`);
  }

  return {
    id: doc.id,
    name: data.name,
    email: data.email,
    password: data.password,
    role: data.role,
    phone: data.phone,
    organization: data.organization,
    barCouncilId: data.barCouncilId,
    creditBalance: Number(data.creditBalance ?? 0),
    freeCaseUsed: Boolean(data.freeCaseUsed),
    freeCaseExpiresAt: asNullableDate(data.freeCaseExpiresAt),
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt)
  };
}

function advocateCaseFromDoc(doc: FirebaseFirestore.DocumentSnapshot): AdvocateCaseRecord {
  const data = doc.data();
  if (!data) {
    throw new Error(`Advocate case ${doc.id} has no data.`);
  }

  return {
    id: doc.id,
    advocateId: data.advocateId,
    caseTitle: data.caseTitle,
    clientName: data.clientName,
    caseType: data.caseType,
    jurisdiction: data.jurisdiction,
    description: data.description,
    status: data.status,
    creditSource: data.creditSource,
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt)
  };
}

function creditTransactionFromDoc(doc: FirebaseFirestore.DocumentSnapshot): CreditTransactionRecord {
  const data = doc.data();
  if (!data) {
    throw new Error(`Credit transaction ${doc.id} has no data.`);
  }

  return {
    id: doc.id,
    advocateId: data.advocateId,
    type: data.type,
    credits: Number(data.credits ?? 0),
    status: data.status,
    packageId: data.packageId,
    amountInr: typeof data.amountInr === "number" ? data.amountInr : undefined,
    caseId: data.caseId,
    metadata: data.metadata,
    createdAt: asDate(data.createdAt)
  };
}

export async function getUserByEmail(email: string) {
  if (env.devLocalDb) return localGetUserByEmail(email);
  const snapshot = await withFirestoreTimeout(collections.users.where("email", "==", email).limit(1).get());
  return snapshot.empty ? null : userFromDoc(snapshot.docs[0]);
}

export async function getUserById(id: string) {
  if (env.devLocalDb) return localGetUserById(id);
  const snapshot = await withFirestoreTimeout(collections.users.doc(id).get());
  return snapshot.exists ? userFromDoc(snapshot) : null;
}

export async function upsertUser(input: {
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
  if (env.devLocalDb) return localUpsertUser(input);
  const existing = await getUserByEmail(input.email);
  const now = new Date();
  const ref = existing ? collections.users.doc(existing.id) : collections.users.doc(input.id ?? randomUUID());

  await ref.set(
    removeUndefined({
      email: input.email,
      password: input.password ?? existing?.password,
      role: input.role,
      name: input.name,
      phone: input.phone,
      organization: input.organization,
      barCouncilId: input.barCouncilId,
      creditBalance: input.creditBalance ?? existing?.creditBalance ?? 0,
      freeCaseUsed: input.freeCaseUsed ?? existing?.freeCaseUsed ?? false,
      freeCaseExpiresAt:
        input.freeCaseExpiresAt === undefined
          ? existing?.freeCaseExpiresAt
            ? toTimestamp(existing.freeCaseExpiresAt)
            : null
          : input.freeCaseExpiresAt
            ? toTimestamp(input.freeCaseExpiresAt)
            : null,
      createdAt: existing ? toTimestamp(existing.createdAt) : toTimestamp(now),
      updatedAt: toTimestamp(now)
    }),
    { merge: true }
  );

  const saved = await ref.get();
  return userFromDoc(saved);
}

export async function createInternRecord(input: Omit<InternRecord, "id" | "createdAt" | "updatedAt" | "deletedAt" | "isRevoked">) {
  if (env.devLocalDb) return localCreateInternRecord(input);
  const now = new Date();
  const ref = collections.interns.doc(randomUUID());
  const intern: InternRecord = {
    ...input,
    id: ref.id,
    isRevoked: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };

  await ref.set({
    ...input,
    joiningDate: toTimestamp(input.joiningDate),
    exitDate: input.exitDate ? toTimestamp(input.exitDate) : null,
    isRevoked: false,
    createdAt: toTimestamp(now),
    updatedAt: toTimestamp(now),
    deletedAt: null
  });

  return intern;
}

export async function listInternRecords(input: {
  search?: string;
  status?: InternStatus;
  includeDeleted?: boolean;
  page: number;
  limit: number;
}) {
  if (env.devLocalDb) return localListInternRecords(input);
  const snapshot = await withFirestoreTimeout(collections.interns.get());
  const all = snapshot.docs
    .map(internFromDoc)
    .filter((intern) => (input.includeDeleted ? true : !intern.deletedAt))
    .filter((intern) => (input.status ? intern.status === input.status : true))
    .filter((intern) => matchesSearch(intern, input.search))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    total: all.length,
    data: all.slice((input.page - 1) * input.limit, input.page * input.limit)
  };
}

export async function getInternById(id: string) {
  if (env.devLocalDb) return localGetInternById(id);
  const snapshot = await withFirestoreTimeout(collections.interns.doc(id).get());
  return snapshot.exists ? internFromDoc(snapshot) : null;
}

export async function getInternByReferenceId(referenceId: string) {
  if (env.devLocalDb) return localGetInternByReferenceId(referenceId);
  const snapshot = await withFirestoreTimeout(collections.interns.where("referenceId", "==", referenceId).limit(1).get());
  return snapshot.empty ? null : internFromDoc(snapshot.docs[0]);
}

export async function updateInternRecord(id: string, input: Partial<Omit<InternRecord, "id" | "createdAt" | "updatedAt">>) {
  if (env.devLocalDb) return localUpdateInternRecord(id, input);
  const ref = collections.interns.doc(id);
  const data: Record<string, unknown> = {
    ...input,
    updatedAt: toTimestamp(new Date())
  };

  if (input.joiningDate) {
    data.joiningDate = toTimestamp(input.joiningDate);
  }

  if ("exitDate" in input) {
    data.exitDate = input.exitDate ? toTimestamp(input.exitDate) : null;
  }

  if ("deletedAt" in input) {
    data.deletedAt = input.deletedAt ? toTimestamp(input.deletedAt) : null;
  }

  await ref.update(data);
  const updated = await ref.get();
  return internFromDoc(updated);
}

export async function createApplicantRecord(
  input: Omit<ApplicantRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">
) {
  if (env.devLocalDb) return localCreateApplicantRecord(input);
  const now = new Date();
  const ref = collections.applicants.doc(randomUUID());
  const applicant: ApplicantRecord = {
    ...input,
    id: ref.id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };

  await ref.set(
    removeUndefined({
      ...input,
      expectedJoiningDate: input.expectedJoiningDate ? toTimestamp(input.expectedJoiningDate) : null,
      createdAt: toTimestamp(now),
      updatedAt: toTimestamp(now),
      deletedAt: null
    })
  );

  return applicant;
}

export async function listApplicantRecords(input: {
  search?: string;
  status?: ApplicantStatus;
  includeDeleted?: boolean;
  page: number;
  limit: number;
}) {
  if (env.devLocalDb) return localListApplicantRecords(input);
  const snapshot = await withFirestoreTimeout(collections.applicants.get());
  const all = snapshot.docs
    .map(applicantFromDoc)
    .filter((applicant) => (input.includeDeleted ? true : !applicant.deletedAt))
    .filter((applicant) => (input.status ? applicant.status === input.status : true))
    .filter((applicant) => matchesApplicantSearch(applicant, input.search))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    total: all.length,
    data: all.slice((input.page - 1) * input.limit, input.page * input.limit)
  };
}

export async function getApplicantById(id: string) {
  if (env.devLocalDb) return localGetApplicantById(id);
  const snapshot = await withFirestoreTimeout(collections.applicants.doc(id).get());
  return snapshot.exists ? applicantFromDoc(snapshot) : null;
}

export async function updateApplicantRecord(
  id: string,
  input: Partial<Omit<ApplicantRecord, "id" | "createdAt" | "updatedAt">>
) {
  if (env.devLocalDb) return localUpdateApplicantRecord(id, input);
  const ref = collections.applicants.doc(id);
  const data: Record<string, unknown> = {
    ...input,
    updatedAt: toTimestamp(new Date())
  };

  if ("expectedJoiningDate" in input) {
    data.expectedJoiningDate = input.expectedJoiningDate ? toTimestamp(input.expectedJoiningDate) : null;
  }

  if ("deletedAt" in input) {
    data.deletedAt = input.deletedAt ? toTimestamp(input.deletedAt) : null;
  }

  await ref.update(removeUndefined(data));
  const updated = await ref.get();
  return applicantFromDoc(updated);
}

export async function listDocumentsByInternId(internId: string) {
  if (env.devLocalDb) return localListDocumentsByInternId(internId);
  const snapshot = await withFirestoreTimeout(collections.documents.where("internId", "==", internId).get());
  return snapshot.docs.map(documentFromDoc).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function listActivityByInternId(internId: string, limit = 30) {
  if (env.devLocalDb) return localListActivityByInternId(internId, limit);
  const snapshot = await withFirestoreTimeout(collections.activityLogs.where("internId", "==", internId).get());
  return snapshot.docs
    .map(activityFromDoc)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function listActivityRecords(input: {
  actions?: string[];
  page: number;
  limit: number;
}) {
  if (env.devLocalDb) return localListActivityRecords(input);
  const snapshot = await withFirestoreTimeout(collections.activityLogs.get());
  const all = snapshot.docs
    .map(activityFromDoc)
    .filter((activity) => (input.actions ? input.actions.includes(activity.action) : true))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    total: all.length,
    data: all.slice((input.page - 1) * input.limit, input.page * input.limit)
  };
}

export async function createDocumentRecord(input: { internId: string; type: DocumentType; fileUrl: string }) {
  if (env.devLocalDb) return localCreateDocumentRecord(input);
  const now = new Date();
  const ref = collections.documents.doc(randomUUID());
  const document: DocumentRecord = {
    id: ref.id,
    internId: input.internId,
    type: input.type,
    fileUrl: input.fileUrl,
    createdAt: now
  };

  await ref.set({
    internId: input.internId,
    type: input.type,
    fileUrl: input.fileUrl,
    createdAt: toTimestamp(now)
  });

  return document;
}

export async function listDocumentRecords(internId?: string) {
  if (env.devLocalDb) return localListDocumentRecords(internId);
  const snapshot = await withFirestoreTimeout(
    internId ? collections.documents.where("internId", "==", internId).get() : collections.documents.get()
  );

  return snapshot.docs.map(documentFromDoc).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getDocumentById(id: string) {
  if (env.devLocalDb) return localGetDocumentById(id);
  const snapshot = await withFirestoreTimeout(collections.documents.doc(id).get());
  return snapshot.exists ? documentFromDoc(snapshot) : null;
}

export async function createActivityLog(input: {
  actorId?: string;
  internId?: string;
  entity: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  if (env.devLocalDb) return localCreateActivityLog(input);
  const now = new Date();
  const ref = collections.activityLogs.doc(randomUUID());

  await ref.set(removeUndefined({
    ...input,
    createdAt: toTimestamp(now)
  }));

  return {
    id: ref.id,
    createdAt: now,
    ...input
  };
}

export async function createAdvocateCase(input: Omit<AdvocateCaseRecord, "id" | "createdAt" | "updatedAt">) {
  if (env.devLocalDb) return localCreateAdvocateCase(input);
  const now = new Date();
  const ref = collections.advocateCases.doc(randomUUID());
  await ref.set(removeUndefined({
    ...input,
    createdAt: toTimestamp(now),
    updatedAt: toTimestamp(now)
  }));
  return {
    ...input,
    id: ref.id,
    createdAt: now,
    updatedAt: now
  };
}

export async function listAdvocateCases(advocateId: string) {
  if (env.devLocalDb) return localListAdvocateCases(advocateId);
  const snapshot = await withFirestoreTimeout(collections.advocateCases.where("advocateId", "==", advocateId).get());
  return snapshot.docs.map(advocateCaseFromDoc).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createCreditTransaction(input: Omit<CreditTransactionRecord, "id" | "createdAt">) {
  if (env.devLocalDb) return localCreateCreditTransaction(input);
  const now = new Date();
  const ref = collections.creditTransactions.doc(randomUUID());
  await ref.set(removeUndefined({
    ...input,
    createdAt: toTimestamp(now)
  }));
  return {
    ...input,
    id: ref.id,
    createdAt: now
  };
}

export async function listCreditTransactions(advocateId?: string) {
  if (env.devLocalDb) return localListCreditTransactions(advocateId);
  const snapshot = await withFirestoreTimeout(
    advocateId
      ? collections.creditTransactions.where("advocateId", "==", advocateId).get()
      : collections.creditTransactions.get()
  );
  return snapshot.docs.map(creditTransactionFromDoc).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function updateCreditTransactionStatus(
  id: string,
  input: { status: CreditTransactionRecord["status"]; metadata?: Record<string, unknown> }
) {
  if (env.devLocalDb) return localUpdateCreditTransactionStatus(id, input);
  const ref = collections.creditTransactions.doc(id);
  const current = await withFirestoreTimeout(ref.get());
  if (!current.exists) {
    throw new AppError("Credit transaction not found.", 404);
  }
  const existing = creditTransactionFromDoc(current);
  await ref.update(removeUndefined({
    status: input.status,
    metadata: {
      ...(existing.metadata ?? {}),
      ...(input.metadata ?? {})
    }
  }));
  const updated = await ref.get();
  return creditTransactionFromDoc(updated);
}

export async function updateAdvocateCredits(
  advocateId: string,
  input: { creditBalance?: number; freeCaseUsed?: boolean; freeCaseExpiresAt?: Date | null }
) {
  if (env.devLocalDb) return localUpdateAdvocateCredits(advocateId, input);
  const ref = collections.users.doc(advocateId);
  await ref.update(removeUndefined({
    creditBalance: input.creditBalance,
    freeCaseUsed: input.freeCaseUsed,
    freeCaseExpiresAt:
      input.freeCaseExpiresAt === undefined ? undefined : input.freeCaseExpiresAt ? toTimestamp(input.freeCaseExpiresAt) : null,
    updatedAt: toTimestamp(new Date())
  }));
  const updated = await ref.get();
  return userFromDoc(updated);
}

export async function checkFirestoreHealth() {
  if (env.devLocalDb) return localDbHealth();
  await withFirestoreTimeout(collections.users.limit(1).get(), 3000);
  return { status: "ok" };
}
