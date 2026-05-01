import { doc, collection, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Build a ref to a user-scoped document:
 * artifacts/{appId}/users/{uid}/{collectionName}/{docId}
 */
export function userDocRef(db, appId, uid, collectionName, docId) {
  return doc(db, 'artifacts', appId, 'users', uid, collectionName, docId);
}

/**
 * Build a ref to a user-scoped collection:
 * artifacts/{appId}/users/{uid}/{collectionName}
 */
export function userColRef(db, appId, uid, collectionName) {
  return collection(db, 'artifacts', appId, 'users', uid, collectionName);
}

/**
 * Save a document with merge + auto-timestamps (createdAt on first write, updatedAt always).
 */
export async function saveUserDoc(db, appId, uid, collectionName, docId, data) {
  const ref = userDocRef(db, appId, uid, collectionName, docId);
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
      ...(data.createdAt ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

/**
 * Delete a user-scoped document.
 */
export async function deleteUserDoc(db, appId, uid, collectionName, docId) {
  await deleteDoc(userDocRef(db, appId, uid, collectionName, docId));
}

/**
 * Build a ref to a workspace-scoped document.
 * Soporta paths anidados via varargs: workspaceDocRef(db, appId, wsId, 'teams', teamId, 'cuaderno', 'jugadores')
 */
export function workspaceDocRef(db, appId, wsId, ...pathSegments) {
  return doc(db, 'artifacts', appId, 'workspaces', wsId, ...pathSegments);
}

/**
 * Build a ref to a workspace-scoped collection.
 */
export function workspaceColRef(db, appId, wsId, ...pathSegments) {
  return collection(db, 'artifacts', appId, 'workspaces', wsId, ...pathSegments);
}

/**
 * Save a workspace-scoped document with merge + auto-timestamps.
 * pathSegments: array de strings, e.g. ['teams', teamId, 'cuaderno', 'jugadores']
 */
export async function saveWorkspaceDoc(db, appId, wsId, pathSegments, data) {
  const ref = workspaceDocRef(db, appId, wsId, ...pathSegments);
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
      ...(data.createdAt ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

/**
 * Delete a workspace-scoped document.
 */
export async function deleteWorkspaceDoc(db, appId, wsId, pathSegments) {
  await deleteDoc(workspaceDocRef(db, appId, wsId, ...pathSegments));
}
