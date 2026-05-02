const BATCH_LIMIT = 200;

/**
 * Recursively copy all docs (with their subcollections) from sourcePath to destPath.
 * Idempotent: uses set merge=true on dest, safe to re-run.
 *
 * @param {FirebaseFirestore.Firestore} db Admin SDK Firestore instance
 * @param {string} sourcePath Path to a collection, e.g. "users/u1/teams"
 * @param {string} destPath Target collection path, e.g. "workspaces/w1/teams"
 * @returns {Promise<number>} Total docs copied (including those in subcollections)
 */
export async function copyCollection(db, sourcePath, destPath) {
  const snap = await db.collection(sourcePath).get();
  let copied = 0;
  let batch = db.batch();
  let writes = 0;

  for (const docSnap of snap.docs) {
    const destRef = db.collection(destPath).doc(docSnap.id);
    batch.set(destRef, docSnap.data(), { merge: true });
    copied++;
    writes++;

    if (writes >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }

    const subcols = await docSnap.ref.listCollections();
    for (const sub of subcols) {
      copied += await copyCollection(
        db,
        `${sourcePath}/${docSnap.id}/${sub.id}`,
        `${destPath}/${docSnap.id}/${sub.id}`,
      );
    }
  }

  if (writes > 0) await batch.commit();
  return copied;
}
