import { Router } from "express";
import { downloadVerificationSummary, submitVerificationRequest, verifyReference } from "../controllers/verify.controller";
import { validateBody, validateParams } from "../middleware/validate.middleware";
import { referenceParamSchema, verificationRequestSchema } from "../utils/schemas";

export const verifyRoutes = Router();

verifyRoutes.get("/:reference_id", validateParams(referenceParamSchema), verifyReference);
verifyRoutes.post(
  "/:reference_id/download",
  validateParams(referenceParamSchema),
  validateBody(verificationRequestSchema),
  downloadVerificationSummary
);
verifyRoutes.post(
  "/:reference_id",
  validateParams(referenceParamSchema),
  validateBody(verificationRequestSchema),
  submitVerificationRequest
);
