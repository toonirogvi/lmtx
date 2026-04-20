import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "../config/firebase";
import { getUserByEmail } from "../services/firestore.service";
import { AppError } from "../utils/errors";
import type { UserRole } from "../types/models";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new AppError("Firebase authentication token is required.", 401));
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase();

    if (!email) {
      return next(new AppError("Firebase account email is required.", 401));
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return next(new AppError("This Firebase user is not authorized for LUMENTIX HRFLOW.", 403));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError("Invalid or expired Firebase authentication token.", 401));
  }
}

export function authorizeRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication is required.", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action.", 403));
    }

    return next();
  };
}
