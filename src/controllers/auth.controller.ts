import { asyncHandler, AppError } from "../utils/errors";
import { getUserById } from "../services/firestore.service";

function toAuthUser(user: NonNullable<Awaited<ReturnType<typeof getUserById>>>) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    credit_balance: user.creditBalance ?? 0,
    free_case_expires_at: user.freeCaseExpiresAt?.toISOString() ?? null,
    free_case_used: Boolean(user.freeCaseUsed)
  };
}

export const login = asyncHandler(async (_req, _res) => {
  throw new AppError("Use Firebase Authentication in the frontend, then call /api/auth/me with the Firebase ID token.", 410);
});

export const logout = asyncHandler(async (_req, res) => {
  return res.json({ message: "Logged out." });
});

export const me = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError("Authentication is required.", 401);
  }

  const user = await getUserById(req.user.id);
  if (!user) {
    throw new AppError("User profile not found.", 404);
  }

  return res.json({ user: toAuthUser(user) });
});
