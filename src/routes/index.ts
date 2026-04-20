import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { advocateRoutes } from "./advocate.routes";
import { applicantRoutes } from "./applicant.routes";
import { bgvRoutes } from "./bgv.routes";
import { documentRoutes } from "./document.routes";
import { internRoutes } from "./intern.routes";
import { systemRoutes } from "./system.routes";
import { verifyRoutes } from "./verify.routes";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/advocate", advocateRoutes);
apiRoutes.use("/bgv", bgvRoutes);
apiRoutes.use("/", applicantRoutes);
apiRoutes.use("/", internRoutes);
apiRoutes.use("/documents", documentRoutes);
apiRoutes.use("/system", systemRoutes);
apiRoutes.use("/verify", verifyRoutes);
