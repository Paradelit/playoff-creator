const BATCH_LIMIT = 200;

export async function addWsIdToNotifications(db, appId, uid, wsId) {
  const colRef = db.collection(`artifacts/${appId}/users/${uid}/proactiveNotifications`);
  const snap = await colRef.get();
  let updated = 0;
  let batch = db.batch();
  let writes = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.wsId) continue;
    batch.update(docSnap.ref, { wsId });
    updated++;
    writes++;
    if (writes >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }
  if (writes > 0) await batch.commit();
  return updated;
}
