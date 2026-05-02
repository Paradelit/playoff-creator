import { copyCollection } from './copyCollection.js';

const TEAM_SUBCOLLECTIONS = ['members', 'trainings', 'competitions', 'cuaderno'];

export async function copyTeamsRecursive(db, appId, uid, wsId) {
  const sourceTeamsPath = `artifacts/${appId}/users/${uid}/teams`;
  const destTeamsPath = `artifacts/${appId}/workspaces/${wsId}/teams`;
  const teamsSnap = await db.collection(sourceTeamsPath).get();

  let total = 0;
  for (const teamDoc of teamsSnap.docs) {
    const teamId = teamDoc.id;
    await db.doc(`${destTeamsPath}/${teamId}`).set(teamDoc.data(), { merge: true });
    total++;

    for (const sub of TEAM_SUBCOLLECTIONS) {
      total += await copyCollection(
        db,
        `${sourceTeamsPath}/${teamId}/${sub}`,
        `${destTeamsPath}/${teamId}/${sub}`,
      );
    }
  }
  return total;
}
