import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

interface CleanupArgs { db: Firestore; appId: string; wsId: string; teamId: string; }

export async function cleanupAfterTeamDelete({ db, appId, wsId, teamId }: CleanupArgs) {
  const grantsCol = await db.collection(`artifacts/${appId}/workspaces/${wsId}/teams/${teamId}/grants`).get();
  for (const grantTypeDoc of grantsCol.docs) {
    const grantees = await db.collection(`${grantTypeDoc.ref.path}/grantees`).get();
    await Promise.all(grantees.docs.map(g => g.ref.delete()));
  }

  const members = await db.collection(`artifacts/${appId}/workspaces/${wsId}/members`).get();
  await Promise.all(members.docs.map(m => m.ref.update({ assignedTeamIds: FieldValue.arrayRemove(teamId) })));

  console.log(`[onTeamDelete] wsId=${wsId} teamId=${teamId} grantTypes=${grantsCol.docs.length} members=${members.docs.length}`);
}

export const onTeamDelete = onDocumentDeleted(
  { region: "europe-west1", document: "artifacts/{appId}/workspaces/{wsId}/teams/{teamId}" },
  async (event) => {
    const { appId, wsId, teamId } = event.params as { appId: string; wsId: string; teamId: string };
    try {
      await cleanupAfterTeamDelete({ db: getFirestore(), appId, wsId, teamId });
    } catch (err) {
      console.error(`[onTeamDelete] FATAL wsId=${wsId} teamId=${teamId}`, (err as Error).message);
    }
  },
);
