import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore';

function teamsCol(uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'teams');
}

function membersCol(teamId, uid, db, appId) {
  return collection(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'members');
}

export function subscribeToTeams(uid, db, appId, callback) {
  const q = query(teamsCol(uid, db, appId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id })));
  });
}

export async function saveTeam(team, { uid, db, appId }) {
  const ref = doc(teamsCol(uid, db, appId), team.id);
  await setDoc(ref, {
    ...team,
    updatedAt: serverTimestamp(),
    ...(team.createdAt ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });
}

export async function deleteTeam(teamId, { uid, db, appId }) {
  await deleteDoc(doc(teamsCol(uid, db, appId), teamId));
}

export function subscribeToMembers(teamId, uid, db, appId, callback) {
  const q = query(membersCol(teamId, uid, db, appId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id })));
  });
}

export async function saveMember(member, teamId, { uid, db, appId }) {
  const ref = doc(membersCol(teamId, uid, db, appId), member.id);
  await setDoc(ref, {
    ...member,
    updatedAt: serverTimestamp(),
    ...(member.createdAt ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });
}

export async function deleteMember(memberId, teamId, { uid, db, appId }) {
  await deleteDoc(doc(membersCol(teamId, uid, db, appId), memberId));
}
