// functions/src/auth/onUserDelete.ts
import * as functionsV1 from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

interface CleanupArgs {
  db: Firestore;
  appId: string;
  uid: string;
}

/**
 * Limpia datos huérfanos cuando un usuario es borrado de Firebase Auth.
 *
 * Sin este trigger (estado pre sub-7 batch CI), los workspaces, memberships
 * y datos de usuario quedaban como zombies en Firestore para siempre cuando
 * un user borraba su cuenta Google / Apple o se borraba manualmente vía
 * Firebase Admin. Esto acumula coste de almacenamiento y rompe forenses
 * tipo "¿quién creó este doc?".
 *
 * Estrategia:
 * 1. Para cada membership del user borrado:
 *    - Si owner de un workspace personal → recursive-delete del workspace
 *      entero (datos del owner, no compartidos).
 *    - Si owner de un workspace de club → log warning (el cleanup manual del
 *      DT debe pasar primero — `transferOwnership` o `deleteWorkspace`).
 *      NO borrar el club porque hay otros miembros con datos.
 *    - Si member non-owner → borrar solo su membership (onMemberDelete
 *      trigger se encarga de grants/invites).
 * 2. Borrar el árbol `users/{uid}/` (preferencias, pickHistory, memberships).
 */
export async function cleanupAfterUserDelete({ db, appId, uid }: CleanupArgs) {
  const membershipsSnap = await db
    .collection(`artifacts/${appId}/users/${uid}/memberships`)
    .get();

  for (const memDoc of membershipsSnap.docs) {
    const wsId = memDoc.id;
    const wsRef = db.doc(`artifacts/${appId}/workspaces/${wsId}`);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) continue;
    const ws = (wsSnap.data() || {}) as { type?: string; ownerId?: string };

    if (ws.type === "personal" && ws.ownerId === uid) {
      // Workspace personal del user borrado: nuke todo el árbol.
      await db.recursiveDelete(wsRef);
      console.log(`[onUserDelete] personal workspace deleted uid=${uid} wsId=${wsId}`);
    } else if (ws.type === "club" && ws.ownerId === uid) {
      // El user era owner de un club. NO borramos el club porque hay otros
      // miembros — eso lo decide el DT con transferOwnership. Sí borramos su
      // membership para que pierda acceso (aunque ya no podrá autenticarse).
      console.warn(
        `[onUserDelete] club owner deleted uid=${uid} wsId=${wsId} — club queda sin owner; revisar manualmente.`,
      );
      await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${uid}`).delete();
    } else {
      // Miembro non-owner: solo borrar su membership. onMemberDelete trigger
      // cascadeará a grants/invites como hace con revokeMember normal.
      await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${uid}`).delete();
    }
  }

  // Borrar el árbol del user (preferencias, pickHistory, memberships cache).
  const userRoot = db.doc(`artifacts/${appId}/users/${uid}`);
  await db.recursiveDelete(userRoot);
  console.log(`[onUserDelete] user tree deleted uid=${uid}`);
}

// Auth triggers SIGUEN siendo v1-only en Firebase Functions. v2 aún no soporta
// auth.user().onDelete (a fecha de 2026-05). Convive con bootstrapPersonalWorkspace
// que también usa v1.
export const onUserDelete = functionsV1
  .region("europe-west1")
  .auth.user()
  .onDelete(async (user) => {
    const appId = process.env.PICK_APP_ID;
    if (!appId) {
      console.error("[onUserDelete] PICK_APP_ID env var missing; skipping");
      return;
    }
    try {
      await cleanupAfterUserDelete({ db: getFirestore(), appId, uid: user.uid });
    } catch (err) {
      console.error(`[onUserDelete] FATAL uid=${user.uid}`, (err as Error).message);
    }
  });
