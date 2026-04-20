import dotenv from "dotenv";

dotenv.config();

const asNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: asNumber(process.env.PORT, 4000),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "ltx-office-96354",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
  devLocalDb: process.env.DEV_LOCAL_DB === "true",
  frontendUrl: process.env.FRONTEND_URL ?? "https://lumentix.in",
  frontendUrls: (process.env.FRONTEND_URL ?? "https://lumentix.in,http://localhost:3000")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
  publicVerifyBaseUrl: process.env.PUBLIC_VERIFY_BASE_URL ?? "https://lumentix.in/verify",
  referenceTimezone: process.env.REFERENCE_TIMEZONE ?? "Asia/Kolkata",
  storageDriver: process.env.STORAGE_DRIVER ?? "local",
  localStorageDir: process.env.LOCAL_STORAGE_DIR ?? "../storage/uploads",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: asNumber(process.env.SMTP_PORT, 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM ?? "LUMENTIX BGV <bgv@lumentix.in>"
};

if (env.nodeEnv === "production" && env.devLocalDb) {
  throw new Error("DEV_LOCAL_DB must be false in production.");
}

if (env.nodeEnv === "production" && env.firestoreEmulatorHost) {
  throw new Error("FIRESTORE_EMULATOR_HOST must not be set in production.");
}

if (env.nodeEnv === "production" && (!env.firebaseClientEmail || !env.firebasePrivateKey)) {
  throw new Error("Firebase Admin credentials must be configured in production.");
}

if (env.nodeEnv === "production" && env.smtpHost && (!env.smtpUser || !env.smtpPass || !env.smtpFrom.includes("@"))) {
  throw new Error("SMTP_USER, SMTP_PASS, and SMTP_FROM must be configured in production when SMTP_HOST is set for email delivery.");
}
