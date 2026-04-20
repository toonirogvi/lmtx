import { AppError } from "../utils/errors";
import type { AdvocateCaseRecord, CreditTransactionRecord, UserRecord } from "../types/models";
import {
  createAdvocateCase,
  createCreditTransaction,
  getUserById,
  listAdvocateCases,
  listCreditTransactions,
  updateAdvocateCredits,
  updateCreditTransactionStatus
} from "./firestore.service";

export const creditPackages = [
  { id: "credits_10", credits: 10, amountInr: 999, label: "10 Case Credits" },
  { id: "credits_25", credits: 25, amountInr: 1999, label: "25 Case Credits" },
  { id: "credits_50", credits: 50, amountInr: 3499, label: "50 Case Credits" }
] as const;

export function freeCaseExpiryDate(now = new Date()) {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function hasFreeCase(user: UserRecord, now = new Date()) {
  return user.role === "Advocate" && !user.freeCaseUsed && Boolean(user.freeCaseExpiresAt && user.freeCaseExpiresAt > now);
}

export function advocateCreditSummary(user: UserRecord, now = new Date()) {
  return {
    credit_balance: user.creditBalance ?? 0,
    free_case_available: hasFreeCase(user, now),
    free_case_used: Boolean(user.freeCaseUsed),
    free_case_expires_at: user.freeCaseExpiresAt?.toISOString() ?? null
  };
}

function toCaseDto(record: AdvocateCaseRecord) {
  return {
    id: record.id,
    advocate_id: record.advocateId,
    case_title: record.caseTitle,
    client_name: record.clientName,
    case_type: record.caseType,
    jurisdiction: record.jurisdiction ?? null,
    description: record.description,
    status: record.status,
    credit_source: record.creditSource,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString()
  };
}

function toCreditTransactionDto(record: CreditTransactionRecord) {
  return {
    id: record.id,
    advocate_id: record.advocateId,
    type: record.type,
    credits: record.credits,
    status: record.status,
    package_id: record.packageId ?? null,
    amount_inr: record.amountInr ?? null,
    case_id: record.caseId ?? null,
    metadata: record.metadata ?? null,
    created_at: record.createdAt.toISOString()
  };
}

export async function getAdvocateDashboard(advocateId: string) {
  const user = await getUserById(advocateId);
  if (!user || user.role !== "Advocate") {
    throw new AppError("Advocate account not found.", 404);
  }

  const [cases, transactions] = await Promise.all([
    listAdvocateCases(advocateId),
    listCreditTransactions(advocateId)
  ]);

  return {
    advocate: {
      id: user.id,
      name: user.name ?? user.email,
      email: user.email,
      phone: user.phone ?? null,
      organization: user.organization ?? null,
      bar_council_id: user.barCouncilId ?? null
    },
    credits: advocateCreditSummary(user),
    cases: cases.map(toCaseDto),
    transactions: transactions.map(toCreditTransactionDto)
  };
}

export async function createAdvocateCaseWithCredit(
  advocateId: string,
  input: {
    caseTitle: string;
    clientName: string;
    caseType: string;
    jurisdiction?: string;
    description: string;
  }
) {
  const user = await getUserById(advocateId);
  if (!user || user.role !== "Advocate") {
    throw new AppError("Advocate account not found.", 404);
  }

  const freeAvailable = hasFreeCase(user);
  const paidCredits = user.creditBalance ?? 0;

  if (!freeAvailable && paidCredits <= 0) {
    throw new AppError("No case credits available. Buy credits or use a valid free case.", 402);
  }

  const creditSource = freeAvailable ? "Free Trial" : "Paid Credit";
  const record = await createAdvocateCase({
    advocateId,
    caseTitle: input.caseTitle,
    clientName: input.clientName,
    caseType: input.caseType,
    jurisdiction: input.jurisdiction,
    description: input.description,
    status: "Open",
    creditSource
  });

  if (freeAvailable) {
    await updateAdvocateCredits(advocateId, { freeCaseUsed: true });
    await createCreditTransaction({
      advocateId,
      type: "FREE_CASE_USED",
      credits: -1,
      status: "Completed",
      caseId: record.id,
      metadata: { caseTitle: input.caseTitle }
    });
  } else {
    await updateAdvocateCredits(advocateId, { creditBalance: paidCredits - 1 });
    await createCreditTransaction({
      advocateId,
      type: "CASE_CREDIT_USED",
      credits: -1,
      status: "Completed",
      caseId: record.id,
      metadata: { caseTitle: input.caseTitle }
    });
  }

  return toCaseDto(record);
}

export async function requestCreditPurchase(
  advocateId: string,
  input: { packageId: string; paymentReference?: string; notes?: string }
) {
  const selected = creditPackages.find((item) => item.id === input.packageId);
  if (!selected) {
    throw new AppError("Unknown credit package.", 400);
  }

  const transaction = await createCreditTransaction({
    advocateId,
    type: "PURCHASE_REQUESTED",
    credits: selected.credits,
    status: "Pending Approval",
    packageId: selected.id,
    amountInr: selected.amountInr,
    metadata: {
      packageLabel: selected.label,
      paymentReference: input.paymentReference,
      notes: input.notes
    }
  });

  return toCreditTransactionDto(transaction);
}

export async function approveCreditPurchase(transactionId: string, approverId: string) {
  const transactions = await listCreditTransactions();
  const transaction = transactions.find((item) => item.id === transactionId);

  if (!transaction || transaction.type !== "PURCHASE_REQUESTED") {
    throw new AppError("Credit purchase request not found.", 404);
  }

  if (transaction.status !== "Pending Approval") {
    throw new AppError("Credit purchase request has already been processed.", 400);
  }

  const user = await getUserById(transaction.advocateId);
  if (!user || user.role !== "Advocate") {
    throw new AppError("Advocate account not found.", 404);
  }

  const updated = await updateCreditTransactionStatus(transaction.id, {
    status: "Completed",
    metadata: { approvedBy: approverId, approvedAt: new Date().toISOString() }
  });
  await updateAdvocateCredits(user.id, { creditBalance: (user.creditBalance ?? 0) + transaction.credits });
  await createCreditTransaction({
    advocateId: user.id,
    type: "PURCHASE_APPROVED",
    credits: transaction.credits,
    status: "Completed",
    packageId: transaction.packageId,
    amountInr: transaction.amountInr,
    metadata: { sourceTransactionId: transaction.id, approvedBy: approverId }
  });

  return toCreditTransactionDto(updated);
}
