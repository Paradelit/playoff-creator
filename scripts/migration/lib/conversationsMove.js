import { copyCollection } from './copyCollection.js';

export async function moveConversationsToPickHistory(db, appId, uid, wsId) {
  const oldPath = `artifacts/${appId}/users/${uid}/conversations`;
  const newPath = `artifacts/${appId}/users/${uid}/pickHistory/${wsId}/conversations`;
  return await copyCollection(db, oldPath, newPath);
}
