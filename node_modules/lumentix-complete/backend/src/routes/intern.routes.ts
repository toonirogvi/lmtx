import { Router } from "express";
import {
  bulkUploadInterns,
  createIntern,
  deleteIntern,
  getIntern,
  listInterns,
  updateIntern
} from "../controllers/intern.controller";
import { authorizeRoles, requireAuth } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.middleware";
import { createInternSchema, idParamSchema, listInternsSchema, updateInternSchema } from "../utils/schemas";

export const internRoutes = Router();

internRoutes.post("/intern", requireAuth, validateBody(createInternSchema), createIntern);
internRoutes.get("/interns", requireAuth, validateQuery(listInternsSchema), listInterns);
internRoutes.post("/interns/bulk-upload", requireAuth, upload.single("file"), bulkUploadInterns);
internRoutes.get("/intern/:id", requireAuth, validateParams(idParamSchema), getIntern);
internRoutes.put("/intern/:id", requireAuth, validateParams(idParamSchema), validateBody(updateInternSchema), updateIntern);
internRoutes.delete("/intern/:id", requireAuth, authorizeRoles("Admin"), validateParams(idParamSchema), deleteIntern);

