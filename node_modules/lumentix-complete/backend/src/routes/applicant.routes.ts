import { Router } from "express";
import {
  createApplicant,
  deleteApplicant,
  getApplicant,
  listApplicants,
  updateApplicant
} from "../controllers/applicant.controller";
import { authorizeRoles, requireAuth } from "../middleware/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware";
import { createApplicantSchema, idParamSchema, listApplicantsSchema, updateApplicantSchema } from "../utils/schemas";

export const applicantRoutes = Router();

applicantRoutes.post("/applicant", requireAuth, validateBody(createApplicantSchema), createApplicant);
applicantRoutes.get("/applicants", requireAuth, validateQuery(listApplicantsSchema), listApplicants);
applicantRoutes.get("/applicant/:id", requireAuth, validateParams(idParamSchema), getApplicant);
applicantRoutes.put("/applicant/:id", requireAuth, validateParams(idParamSchema), validateBody(updateApplicantSchema), updateApplicant);
applicantRoutes.delete("/applicant/:id", requireAuth, authorizeRoles("Admin"), validateParams(idParamSchema), deleteApplicant);
