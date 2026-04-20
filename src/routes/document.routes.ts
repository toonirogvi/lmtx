import { Router } from "express";
import {
  downloadDocument,
  emailDocument,
  generateDocument,
  listDocuments
} from "../controllers/document.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware";
import {
  emailDocumentSchema,
  generateDocumentSchema,
  idParamSchema,
  listDocumentsSchema
} from "../utils/schemas";

export const documentRoutes = Router();

documentRoutes.get("/", requireAuth, validateQuery(listDocumentsSchema), listDocuments);
documentRoutes.post("/generate", requireAuth, validateBody(generateDocumentSchema), generateDocument);
documentRoutes.get("/:id/download", requireAuth, validateParams(idParamSchema), downloadDocument);
documentRoutes.post("/:id/email", requireAuth, validateParams(idParamSchema), validateBody(emailDocumentSchema), emailDocument);

