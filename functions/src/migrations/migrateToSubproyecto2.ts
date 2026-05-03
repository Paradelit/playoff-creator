import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";

interface MigrationResult {
  workspacesProcessed: number;
  membershipsBackfilled: number;
  docsBackfilled: number;
  durationMs: number;
}

// Sergio Paradela París · serpa2003@gmail.com — único uid autorizado para
// disparar la migración. Si necesita rotarse, redeploy con el valor nuevo.
const SUPERADMIN_UID = "y6vqlMynjRQeRpAKUnYmQdUiMen1";

const APP_ID = "uros-fbm-app"; // único appId en prod

async function backfillCreatedByInCollection(
  db: admin.firestore.Firestore,
  collectionPath: string,
  ownerId: string,
): Promise<number> {
  const snap = await db.collection(collectionPath).get();
  let backfilled = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.createdBy === undefined) {
      await doc.ref.update({ createdBy: ownerId });
      backfilled += 1;
    }
  }
  return backfilled;
}

interface HandlerArgs {
  db: admin.firestore.Firestore;
  uid: string;
}

export async function handleMigration({ db, uid }: HandlerArgs): Promise<MigrationResult> {
  if (uid !== SUPERADMIN_UID) {
    throw new HttpsError("permission-denied", "Solo super-admin puede ejecutar la migración");
  }
  logger.info("[sub2-migration] start", { uid });
  const start = Date.now();

  const workspacesSnap = await db.collection(`artifacts/${APP_ID}/workspaces`).get();

  let workspacesProcessed = 0;
  let membershipsBackfilled = 0;
  let docsBackfilled = 0;

  for (const wsDoc of workspacesSnap.docs) {
    const ws = wsDoc.data();
    const wsId = wsDoc.id;
    const ownerId = ws.ownerId as string | undefined;
    if (!ownerId) {
      logger.warn("[sub2-migration] workspace sin ownerId, skip", { wsId });
      continue;
    }

    const teamsSnap = await db.collection(`artifacts/${APP_ID}/workspaces/${wsId}/teams`).get();
    const allTeamIds = teamsSnap.docs.map((d) => d.id);

    const membersSnap = await db
      .collection(`artifacts/${APP_ID}/workspaces/${wsId}/members`)
      .get();
    for (const memberDoc of membersSnap.docs) {
      const m = memberDoc.data();
      const updates: Record<string, unknown> = {};
      if (m.role === undefined) {
        updates.role = "dt";
      }
      if (m.assignedTeamIds === undefined) {
        updates.assignedTeamIds = allTeamIds;
      }
      if (Object.keys(updates).length > 0) {
        await memberDoc.ref.update(updates);
        membershipsBackfilled += 1;
        logger.info("[sub2-migration] membership backfilled", {
          wsId,
          uid: memberDoc.id,
          updates,
        });
      }
    }

    docsBackfilled += await backfillCreatedByInCollection(
      db,
      `artifacts/${APP_ID}/workspaces/${wsId}/exercises`,
      ownerId,
    );
    docsBackfilled += await backfillCreatedByInCollection(
      db,
      `artifacts/${APP_ID}/workspaces/${wsId}/brackets`,
      ownerId,
    );
    docsBackfilled += await backfillCreatedByInCollection(
      db,
      `artifacts/${APP_ID}/workspaces/${wsId}/calendarSessions`,
      ownerId,
    );

    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      const teamPath = `artifacts/${APP_ID}/workspaces/${wsId}/teams/${teamId}`;
      docsBackfilled += await backfillCreatedByInCollection(db, `${teamPath}/trainings`, ownerId);
      docsBackfilled += await backfillCreatedByInCollection(db, `${teamPath}/members`, ownerId);
      // Cuaderno NO se backfilea: docs singleton sin createdBy semantic.
    }

    workspacesProcessed += 1;
  }

  const result: MigrationResult = {
    workspacesProcessed,
    membershipsBackfilled,
    docsBackfilled,
    durationMs: Date.now() - start,
  };
  logger.info("[sub2-migration] done", result);
  return result;
}

export const migrateToSubproyecto2 = onCall<unknown, Promise<MigrationResult>>(
  { region: "europe-west1", timeoutSeconds: 540, memory: "1GiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Auth required");
    }
    return handleMigration({ db: admin.firestore(), uid: req.auth.uid });
  },
);
