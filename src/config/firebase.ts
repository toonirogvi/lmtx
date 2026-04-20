import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env";

function privateKey() {
  return env.firebasePrivateKey?.replace(/\\n/g, "\n");
}

function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  if (env.firestoreEmulatorHost) {
    return admin.initializeApp({
      projectId: env.firebaseProjectId
    });
  }

  if (env.firebaseProjectId && env.firebaseClientEmail && privateKey()) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebaseProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: privateKey()
      })
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: env.firebaseProjectId
  });
}

initializeFirebase();

export const firestore = getFirestore();
export const firebaseAuth = getAuth();
