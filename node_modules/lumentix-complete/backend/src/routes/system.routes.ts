import { Router } from "express";
import { getSystemStatus } from "../controllers/system.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const systemRoutes = Router();

systemRoutes.get("/status", requireAuth, getSystemStatus);
