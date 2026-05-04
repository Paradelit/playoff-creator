import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

interface CleanupArgs { db: Firestore; appId: string; wsId: string; memberUid: string; }

export async function cleanupAfterMemberDelete({ db, appId, wsId, memberUid }: CleanupArgs) {
  const granteesAsTo = await db.collectionGroup("grantees")
    .where("workspaceId", "==", wsId)
    .where("grantedTo", "==", memberUid).get();
  const granteesAsBy = await db.collectionGroup("grantees")
    .where("workspaceId", "==", wsId)
    .where("grantedBy", "==", memberUid).get();
  const invites = await db.collectionGroup("invites")
    .where("workspaceId", "==", wsId)
    .where("invitedBy", "==", memberUid).get();

  const all = [...granteesAsTo.docs, ...granteesAsBy.docs, ...invites.docs];
  await Promise.all(all.map(d => d.ref.delete()));

  console.log(`[onMemberDelete] wsId=${wsId} uid=${memberUid} cleaned grantsTo=${granteesAsTo.docs.length} grantsBy=${granteesAsBy.docs.length} invites=${invites.docs.length}`);
}

export const onMemberDelete = onDocumentDeleted(
  { region: "europe-west1", document: "artifacts/{appId}/workspaces/{wsId}/members/{memberUid}" },
  async (event) => {
    const { appId, wsId, memberUid } = event.params as { appId: string; wsId: string; memberUid: string };
    try {
      await cleanupAfterMemberDelete({ db: getFirestore(), appId, wsId, memberUid });
    } catch (err) {
      console.error(`[onMemberDelete] FATAL wsId=${wsId} uid=${memberUid}`, (err as Error).message);
    }
  },
);
