export async function countDocsRecursive(db, path) {
  const snap = await db.collection(path).get();
  let total = snap.size;
  for (const docSnap of snap.docs) {
    const subcols = await docSnap.ref.listCollections();
    for (const sub of subcols) {
      total += await countDocsRecursive(db, `${path}/${docSnap.id}/${sub.id}`);
    }
  }
  return total;
}

const COLLECTIONS_TO_VERIFY = ['brackets', 'calendarSessions', 'playoffConvocatorias', 'exercises', 'teams'];

export async function verifyMigration(db, appId, uid, wsId) {
  const oldBase = `artifacts/${appId}/users/${uid}`;
  const newBase = `artifacts/${appId}/workspaces/${wsId}`;

  const diffs = [];
  for (const name of COLLECTIONS_TO_VERIFY) {
    const [oldCount, newCount] = await Promise.all([
      countDocsRecursive(db, `${oldBase}/${name}`),
      countDocsRecursive(db, `${newBase}/${name}`),
    ]);
    if (oldCount !== newCount) {
      diffs.push({ name, oldCount, newCount });
    }
  }

  // Verify conversations were copied to pickHistory/{wsId}/conversations.
  const [oldConvosCount, newConvosCount] = await Promise.all([
    countDocsRecursive(db, `${oldBase}/conversations`),
    countDocsRecursive(db, `${oldBase}/pickHistory/${wsId}/conversations`),
  ]);
  if (oldConvosCount !== newConvosCount) {
    diffs.push({ name: 'conversations (pickHistory)', oldCount: oldConvosCount, newCount: newConvosCount });
  }

  // Verify every proactiveNotification was tagged with a wsId.
  const notifsSnap = await db.collection(`${oldBase}/proactiveNotifications`).get();
  const notifsWithoutWsId = notifsSnap.docs.filter((d) => !d.data().wsId).length;
  if (notifsWithoutWsId > 0) {
    diffs.push({ name: 'notifications without wsId', oldCount: notifsWithoutWsId, newCount: 0 });
  }

  return { ok: diffs.length === 0, diffs };
}
