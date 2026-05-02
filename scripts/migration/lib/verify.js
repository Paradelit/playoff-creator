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

  return { ok: diffs.length === 0, diffs };
}
