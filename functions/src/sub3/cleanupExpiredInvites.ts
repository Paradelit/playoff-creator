import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

export async function runCleanupExpiredInvites({ db }: { db: Firestore }) {
  const now = Timestamp.now();
  const snap = await db.collectionGroup("invites").where("expiresAt", "<", now).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
  console.log(`[cleanupExpiredInvites] deleted=${snap.docs.length}`);
  return { deleted: snap.docs.length };
}

export const cleanupExpiredInvites = onSchedule(
  { region: "europe-west1", schedule: "every 24 hours", timeZone: "Europe/Madrid" },
  async () => {
    try { await runCleanupExpiredInvites({ db: getFirestore() }); }
    catch (err) { console.error("[cleanupExpiredInvites] FATAL", (err as Error).message); }
  },
);
