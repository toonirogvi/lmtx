import { Timestamp } from "firebase-admin/firestore";
import { env } from "../config/env";
import { formatReferenceDay } from "../utils/date";
import { collections } from "./firestore.service";
import { localGenerateReferenceSerial } from "./localDb.service";

export async function generateReferenceId(date = new Date()) {
  const day = formatReferenceDay(date, env.referenceTimezone);

  if (env.devLocalDb) {
    const serial = await localGenerateReferenceSerial(day);
    return `LTX-${day}-${String(serial).padStart(4, "0")}`;
  }

  const counterRef = collections.referenceCounters.doc(day);

  const serial = await collections.referenceCounters.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const current = snapshot.exists ? Number(snapshot.data()?.serial ?? 0) : 0;
    const next = current + 1;

    transaction.set(
      counterRef,
      {
        serial: next,
        updatedAt: Timestamp.fromDate(new Date())
      },
      { merge: true }
    );

    return next;
  });

  return `LTX-${day}-${String(serial).padStart(4, "0")}`;
}
