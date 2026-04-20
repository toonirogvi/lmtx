import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: "Too many authentication attempts. Please try again later." },
  standardHeaders: "draft-7",
  legacyHeaders: false
});

export const publicVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { message: "Too many verification attempts. Please try again later." },
  standardHeaders: "draft-7",
  legacyHeaders: false
});

export const advocateSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { message: "Too many advocate registration attempts. Please try again later." },
  standardHeaders: "draft-7",
  legacyHeaders: false
});

export function requireJsonContent(req: Request, _res: Response, next: NextFunction) {
  if (["POST", "PUT", "PATCH"].includes(req.method) && !req.is("application/json") && !req.is("multipart/form-data")) {
    return next(new AppError("Content-Type must be application/json.", 415));
  }

  return next();
}
