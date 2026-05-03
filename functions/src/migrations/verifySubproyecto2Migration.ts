import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

interface VerifyResult {
  membershipsMissingRole: number;
  membershipsMissingAssignedTeamIds: number;
  docsMissingCreatedBy: number;
  ok: boolean;
}

const SUPERADMIN_UID = "y6vqlMynjRQeRpAKUnYmQdUiMen1"; // serpa2003@gmail.com
const APP_ID = "uros-fbm-app";

const COLLECTIONS_PLAIN = ["exercises", "brackets", "calendarSessions"] as const;
const TEAM_SUBCOLLECTIONS = ["trainings", "members"] as const;
// Cuaderno NO se verifica: docs singleton sin createdBy semantic.

async function countMissing(
  db: admin.firestore.Firestore,
  collectionPath: string,
  field: string,
): Promise<number> {
  const snap = await db.collection(collectionPath).get();
  return snap.docs.filter((d) => d.data()[field] === undefined).length;
}

export const verifySubproyecto2Migration = onCall<unknown, Promise<VerifyResult>>(
  { region: "europe-west1", timeoutSeconds: 540, memory: "1GiB" },
  async (req) => {
    if (!req.auth || req.auth.uid !== SUPERADMIN_UID) {
      throw new HttpsError("permission-denied", "Solo super-admin");
    }
    const db = admin.firestore();
    let membershipsMissingRole = 0;
    let membershipsMissingAssignedTeamIds = 0;
    let docsMissingCreatedBy = 0;

    const workspacesSnap = await db.collection(`artifacts/${APP_ID}/workspaces`).get();
    for (const wsDoc of workspacesSnap.docs) {
      const wsId = wsDoc.id;

      const membersSnap = await db
        .collection(`artifacts/${APP_ID}/workspaces/${wsId}/members`)
        .get();
      for (const m of membersSnap.docs) {
        if (m.data().role === undefined) membershipsMissingRole += 1;
        if (m.data().assignedTeamIds === undefined) membershipsMissingAssignedTeamIds += 1;
      }

      for (const c of COLLECTIONS_PLAIN) {
        docsMissingCreatedBy += await countMissing(
          db,
          `artifacts/${APP_ID}/workspaces/${wsId}/${c}`,
          "createdBy",
        );
      }

      const teamsSnap = await db
        .collection(`artifacts/${APP_ID}/workspaces/${wsId}/teams`)
        .get();
      for (const t of teamsSnap.docs) {
        const teamPath = `artifacts/${APP_ID}/workspaces/${wsId}/teams/${t.id}`;
        for (const c of TEAM_SUBCOLLECTIONS) {
          docsMissingCreatedBy += await countMissing(db, `${teamPath}/${c}`, "createdBy");
        }
      }
    }

    return {
      membershipsMissingRole,
      membershipsMissingAssignedTeamIds,
      docsMissingCreatedBy,
      ok:
        membershipsMissingRole === 0 &&
        membershipsMissingAssignedTeamIds === 0 &&
        docsMissingCreatedBy === 0,
    };
  },
);
