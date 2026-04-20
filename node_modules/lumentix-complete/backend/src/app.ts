import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { apiRoutes } from "./routes";
import { verifyRoutes } from "./routes/verify.routes";
import { errorHandler, notFoundHandler } from "./utils/errors";
import { checkFirestoreHealth } from "./services/firestore.service";
import {
  authLimiter,
  advocateSignupLimiter,
  globalLimiter,
  publicVerificationLimiter,
  requireJsonContent
} from "./middleware/security.middleware";

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginResourcePolicy: false
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isConfiguredOrigin = env.frontendUrls.includes(origin);
      const isLocalDevOrigin = env.nodeEnv === "development" && /^http:\/\/localhost:30\d{2}$/.test(origin);
      callback(null, isConfiguredOrigin || isLocalDevOrigin);
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requireJsonContent);
app.use(globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/advocate/register", advocateSignupLimiter);
app.use(["/api/verify", "/verify"], publicVerificationLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "lumentix-internflow-backend" });
});

app.get("/health/firebase", async (_req, res, next) => {
  try {
    const health = await checkFirestoreHealth();
    res.json({ service: "firestore", ...health });
  } catch (error) {
    next(error);
  }
});

app.use("/api", apiRoutes);
app.use("/verify", verifyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
