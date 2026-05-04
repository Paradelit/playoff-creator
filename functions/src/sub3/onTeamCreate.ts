import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Firestore, DocumentData } from "firebase-admin/firestore";

interface SyncArgs {
  db: Firestore;
  appId: string;
  wsId: string;
  teamId: string;
  team?: DocumentData;
}

export async function syncOnTeamCreate({ db, appId, wsId, teamId, team }: SyncArgs) {
  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) return;
  const ws = wsSnap.data()!;

  if (ws.type === "personal") {
    // Personal: hay un único member (owner). Auto-asignar el teamId.
    const members = await db.collection(`artifacts/${appId}/workspaces/${wsId}/members`).get();
    await Promise.all(
      members.docs.map((m) => m.ref.update({ assignedTeamIds: FieldValue.arrayUnion(teamId) })),
    );
    console.log(`[onTeamCreate] personal sync wsId=${wsId} teamId=${teamId} members=${members.docs.length}`);
    return;
  }

  if (ws.type === "club") {
    // Club: auto-asignar al `createdBy` del team. Sin esto, el creador (que
    // típicamente es el DT que va a entrenar el equipo) no podría ver/
    // escribir en sus propias subcollections (rules requieren isAssignedToTeam).
    // Fallback al ownerId si createdBy no existe (legacy o write directo).
    const createdBy = (team?.createdBy as string | undefined) ?? (ws.ownerId as string | undefined);
    if (!createdBy) {
      console.warn(`[onTeamCreate] club wsId=${wsId} teamId=${teamId} sin createdBy ni ownerId — no auto-assign.`);
      return;
    }
    const memberRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${createdBy}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      console.warn(`[onTeamCreate] club wsId=${wsId} teamId=${teamId} createdBy=${createdBy} no es member.`);
      return;
    }
    await memberRef.update({ assignedTeamIds: FieldValue.arrayUnion(teamId) });
    console.log(`[onTeamCreate] club assign wsId=${wsId} teamId=${teamId} → ${createdBy}`);
  }
}

export const onTeamCreate = onDocumentCreated(
  { region: "europe-west1", document: "artifacts/{appId}/workspaces/{wsId}/teams/{teamId}" },
  async (event) => {
    const { appId, wsId, teamId } = event.params as { appId: string; wsId: string; teamId: string };
    const team = event.data?.data();
    try {
      await syncOnTeamCreate({ db: getFirestore(), appId, wsId, teamId, team });
    } catch (err) {
      console.error(`[onTeamCreate] FATAL wsId=${wsId} teamId=${teamId}`, (err as Error).message);
    }
  },
);
