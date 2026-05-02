import { getFirestore, FieldValue } from "firebase-admin/firestore";

export interface BootstrapResult {
  status: "created" | "skipped";
  wsId: string;
}

/**
 * Creates a personal workspace + member doc + memberships cache for a new user.
 * Idempotent: if a personal workspace owned by the user already exists, returns it
 * with status='skipped' so re-runs of the trigger (e.g. retried delivery) are no-op.
 */
export async function bootstrapPersonalWorkspace(
  user: { uid: string },
  appId: string,
): Promise<BootstrapResult> {
  const db = getFirestore();
  const uid = user.uid;

  // Idempotency: check if a personal workspace owned by this user already exists.
  const existingSnap = await db
    .collection(`artifacts/${appId}/workspaces`)
    .where("type", "==", "personal")
    .where("ownerId", "==", uid)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return { status: "skipped", wsId: existingSnap.docs[0].id };
  }

  // Generate the workspace id client-side so we can use it in three coordinated writes.
  const newWsId = db.collection(`artifacts/${appId}/workspaces`).doc().id;
  const now = FieldValue.serverTimestamp();

  await db
    .batch()
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}`), {
      type: "personal",
      name: "Mi cuenta",
      ownerId: uid,
      createdAt: now,
      updatedAt: now,
      plan: "free",
      planUpdatedAt: null,
      billing: null,
      migrationCompleteAt: now,
    })
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}/members/${uid}`), {
      role: "owner",
      assignedTeamIds: [],
      joinedAt: now,
    })
    .set(db.doc(`artifacts/${appId}/users/${uid}/memberships/${newWsId}`), {
      role: "owner",
      workspaceName: "Mi cuenta",
      workspaceType: "personal",
      joinedAt: now,
    })
    .commit();

  console.log(`[bootstrapPersonalWorkspace] created wsId=${newWsId} for uid=${uid}`);
  return { status: "created", wsId: newWsId };
}
