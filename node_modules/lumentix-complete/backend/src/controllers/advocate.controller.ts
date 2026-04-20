import { firebaseAuth } from "../config/firebase";
import { asyncHandler, AppError } from "../utils/errors";
import { getUserByEmail, upsertUser, createCreditTransaction } from "../services/firestore.service";
import {
  approveCreditPurchase,
  createAdvocateCaseWithCredit,
  creditPackages,
  freeCaseExpiryDate,
  getAdvocateDashboard,
  requestCreditPurchase
} from "../services/advocate.service";

export const registerAdvocate = asyncHandler(async (req, res) => {
  const input = req.body as {
    name: string;
    email: string;
    password: string;
    phone: string;
    organization: string;
    bar_council_id: string;
  };
  const normalizedEmail = input.email.toLowerCase();
  const existing = await getUserByEmail(normalizedEmail);

  if (existing) {
    throw new AppError("An account already exists for this email.", 409);
  }

  let firebaseUser;
  try {
    firebaseUser = await firebaseAuth.createUser({
      email: normalizedEmail,
      password: input.password,
      displayName: input.name,
      emailVerified: false,
      disabled: false
    });
  } catch (error) {
    if ((error as { code?: string }).code === "auth/email-already-exists") {
      throw new AppError("A Firebase account already exists for this email.", 409);
    }
    throw error;
  }

  const freeCaseExpiresAt = freeCaseExpiryDate();
  const user = await upsertUser({
    id: firebaseUser.uid,
    name: input.name,
    email: normalizedEmail,
    role: "Advocate",
    phone: input.phone,
    organization: input.organization,
    barCouncilId: input.bar_council_id,
    creditBalance: 0,
    freeCaseUsed: false,
    freeCaseExpiresAt
  });

  await createCreditTransaction({
    advocateId: user.id,
    type: "FREE_CASE_GRANTED",
    credits: 1,
    status: "Completed",
    metadata: { expiresAt: freeCaseExpiresAt.toISOString() }
  });

  return res.status(201).json({
    firebase_custom_token: await firebaseAuth.createCustomToken(firebaseUser.uid),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      credit_balance: user.creditBalance ?? 0,
      free_case_expires_at: user.freeCaseExpiresAt?.toISOString() ?? null,
      free_case_used: Boolean(user.freeCaseUsed)
    }
  });
});

export const listCreditPackages = asyncHandler(async (_req, res) => {
  return res.json({ data: creditPackages });
});

export const getMyAdvocateDashboard = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication is required.", 401);
  }

  return res.json({ data: await getAdvocateDashboard(req.user.id) });
});

export const createMyAdvocateCase = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication is required.", 401);
  }

  const input = req.body as {
    case_title: string;
    client_name: string;
    case_type: string;
    jurisdiction?: string;
    description: string;
  };

  const data = await createAdvocateCaseWithCredit(req.user.id, {
    caseTitle: input.case_title,
    clientName: input.client_name,
    caseType: input.case_type,
    jurisdiction: input.jurisdiction,
    description: input.description
  });

  return res.status(201).json({ data });
});

export const requestMyCreditPurchase = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication is required.", 401);
  }

  const input = req.body as { package_id: string; payment_reference?: string; notes?: string };
  const data = await requestCreditPurchase(req.user.id, {
    packageId: input.package_id,
    paymentReference: input.payment_reference,
    notes: input.notes
  });

  return res.status(201).json({
    data,
    message: "Credit purchase request submitted. Credits are added after payment/admin approval."
  });
});

export const approveAdvocateCreditPurchase = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication is required.", 401);
  }

  const data = await approveCreditPurchase(req.body.transaction_id, req.user.id);
  return res.json({ data, message: "Credit purchase approved." });
});
