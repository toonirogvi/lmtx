import { env } from "../config/env";
import { checkFirestoreHealth } from "../services/firestore.service";
import { asyncHandler } from "../utils/errors";

const collections = [
  "users",
  "interns",
  "applicants",
  "documents",
  "activityLogs",
  "advocateCases",
  "creditTransactions",
  "referenceCounters"
];

function databaseDriver() {
  if (env.devLocalDb) return "local-dev-db";
  if (env.firestoreEmulatorHost) return "firestore-emulator";
  return "cloud-firestore";
}

function smtpReady() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom.includes("@"));
}

function smtpEnabled() {
  return Boolean(env.smtpHost);
}

function readinessChecks(databaseHealthy: boolean) {
  return [
    {
      key: "database",
      label: "Database connection",
      status: databaseHealthy ? "ok" : "attention",
      detail: databaseHealthy ? "Database health check is passing." : "Database health check needs attention."
    },
    {
      key: "firebaseProject",
      label: "Firebase project",
      status: env.firebaseProjectId ? "ok" : "attention",
      detail: env.firebaseProjectId ? `Using ${env.firebaseProjectId}.` : "Firebase project ID is missing."
    },
    {
      key: "storage",
      label: "Document storage",
      status: env.storageDriver ? "ok" : "attention",
      detail: `Storage driver: ${env.storageDriver}.`
    },
    {
      key: "verification",
      label: "Public verification URL",
      status: env.publicVerifyBaseUrl ? "ok" : "attention",
      detail: env.publicVerifyBaseUrl || "Public verification base URL is missing."
    },
    {
      key: "smtp",
      label: "Email delivery",
      status: !smtpEnabled() || smtpReady() ? "ok" : "attention",
      detail: !smtpEnabled()
        ? "SMTP is optional and currently disabled. Public verification uses verifier details directly."
        : smtpReady()
        ? `SMTP is configured for ${env.smtpFrom}.`
        : "SMTP_HOST is set, but SMTP_USER, SMTP_PASS, or SMTP_FROM is incomplete."
    },
    {
      key: "mode",
      label: "Runtime mode",
      status: env.nodeEnv === "production" && env.devLocalDb ? "attention" : "ok",
      detail: env.devLocalDb
        ? "Local data mode is enabled for development."
        : "Firestore-backed data mode is enabled."
    }
  ];
}

export const getSystemStatus = asyncHandler(async (_req, res) => {
  let databaseHealth: Record<string, unknown> = { status: "unknown" };
  let databaseHealthy = false;

  try {
    databaseHealth = await checkFirestoreHealth();
    databaseHealthy = databaseHealth.status === "ok";
  } catch (error) {
    databaseHealth = {
      status: "attention",
      message: error instanceof Error ? error.message : "Database health check failed."
    };
  }

  return res.json({
    data: {
      service: "LUMENTIX HRFLOW",
      generated_at: new Date().toISOString(),
      environment: env.nodeEnv,
      database: {
        driver: databaseDriver(),
        project_id: env.firebaseProjectId,
        emulator_host: env.firestoreEmulatorHost ?? null,
        health: databaseHealth,
        collections
      },
      storage: {
        driver: env.storageDriver,
        local_directory: env.storageDriver === "local" ? env.localStorageDir : null
      },
      verification: {
        public_verify_base_url: env.publicVerifyBaseUrl,
        frontend_origins: env.frontendUrls
      },
      email: {
        smtp_configured: smtpReady(),
        host: env.smtpHost ?? null,
        port: env.smtpPort,
        user: env.smtpUser ?? null,
        from: env.smtpFrom
      },
      readiness: readinessChecks(databaseHealthy)
    }
  });
});
