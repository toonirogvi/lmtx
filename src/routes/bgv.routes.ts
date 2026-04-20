import { Router } from "express";
import { listBgvAccessLogs } from "../controllers/bgv.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateQuery } from "../middleware/validate.middleware";
import { listBgvAccessLogsSchema } from "../utils/schemas";

export const bgvRoutes = Router();

bgvRoutes.get("/access-logs", requireAuth, validateQuery(listBgvAccessLogsSchema), listBgvAccessLogs);
