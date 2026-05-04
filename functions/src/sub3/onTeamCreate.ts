import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

interface SyncArgs { db: Firestore; appId: string; wsId: string; teamId: string; }

export async function syncOnTeamCreate({ db, appId, wsId, teamId }: SyncArgs) {
  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) return;
  if (wsSnap.data()!.type !== "personal") return;

  const members = await db.collection(`artifacts/${appId}/workspaces/${wsId}/members`).get();
  await Promise.all(members.docs.map(m => m.ref.update({ assignedTeamIds: FieldValue.arrayUnion(teamId) })));
  console.log(`[onTeamCreate] personal sync wsId=${wsId} teamId=${teamId} members=${members.docs.length}`);
}

export const onTeamCreate = onDocumentCreated(
  { region: "europe-west1", document: "artifacts/{appId}/workspaces/{wsId}/teams/{teamId}" },
  async (event) => {
    const { appId, wsId, teamId } = event.params as { appId: string; wsId: string; teamId: string };
    try {
      await syncOnTeamCreate({ db: getFirestore(), appId, wsId, teamId });
    } catch (err) {
      console.error(`[onTeamCreate] FATAL wsId=${wsId} teamId=${teamId}`, (err as Error).message);
    }
  },
);
