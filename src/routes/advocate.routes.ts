import { Router } from "express";
import {
  approveAdvocateCreditPurchase,
  createMyAdvocateCase,
  getMyAdvocateDashboard,
  listCreditPackages,
  registerAdvocate,
  requestMyCreditPurchase
} from "../controllers/advocate.controller";
import { authorizeRoles, requireAuth } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  advocateCaseSchema,
  advocateRegisterSchema,
  approveCreditPurchaseSchema,
  creditPurchaseSchema
} from "../utils/schemas";

export const advocateRoutes = Router();

advocateRoutes.get("/packages", listCreditPackages);
advocateRoutes.post("/register", validateBody(advocateRegisterSchema), registerAdvocate);
advocateRoutes.get("/me", requireAuth, authorizeRoles("Advocate"), getMyAdvocateDashboard);
advocateRoutes.post("/cases", requireAuth, authorizeRoles("Advocate"), validateBody(advocateCaseSchema), createMyAdvocateCase);
advocateRoutes.post(
  "/credits/purchase",
  requireAuth,
  authorizeRoles("Advocate"),
  validateBody(creditPurchaseSchema),
  requestMyCreditPurchase
);
advocateRoutes.post(
  "/credits/approve",
  requireAuth,
  authorizeRoles("Admin"),
  validateBody(approveCreditPurchaseSchema),
  approveAdvocateCreditPurchase
);
