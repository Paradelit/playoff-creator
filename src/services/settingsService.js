import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { saveMember } from './teamsService';

// ─── Profile ───────────────────────────────────────────────────────────────

function profileDoc(uid, db, appId) {
  return doc(db, 'artifacts', appId, 'users', uid, 'profile', 'main');
}

export function subscribeToProfile(uid, db, appId, callback) {
  return onSnapshot(profileDoc(uid, db, appId), snap => {
    callback(snap.exists() ? snap.data() : {});
  });
}

export async function saveProfile(profile, { uid, db, appId }) {
  await setDoc(profileDoc(uid, db, appId), {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function uploadLogoClub(file, { uid, storage, db, appId }) {
  const storageRef = ref(storage, `users/${uid}/logo-club`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await saveProfile({ logoClub: url }, { uid, db, appId });
  return url;
}

// Auto-añadir el entrenador como staff al crear un equipo
export async function autoAddCoachToTeam(teamId, profile, { uid, db, appId }) {
  if (!profile?.nombre?.trim()) return;
  const member = {
    id: crypto.randomUUID(),
    tipo: 'staff',
    nombre: profile.nombre.trim(),
    fechaNacimiento: profile.fechaNacimiento || '',
    dni: profile.dni || '',
    alergias: profile.alergias || '',
    rol: profile.rol || 'Entrenador',
    licencia: profile.licencia || '',
  };
  await saveMember(member, teamId, { uid, db, appId });
}

// ─── Export ────────────────────────────────────────────────────────────────

export async function exportUserData(uid, db, appId) {
  const base = ['artifacts', appId, 'users', uid];

  const profileSnap = await getDoc(doc(db, ...base, 'profile', 'main'));
  const profile = profileSnap.exists() ? profileSnap.data() : {};

  const teamsSnap = await getDocs(collection(db, ...base, 'teams'));
  const teams = teamsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

  const members = {};
  const trainings = {};
  for (const team of teams) {
    const mSnap = await getDocs(collection(db, ...base, 'teams', team.id, 'members'));
    members[team.id] = mSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const tSnap = await getDocs(collection(db, ...base, 'teams', team.id, 'trainings'));
    trainings[team.id] = tSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  }

  const exercisesSnap = await getDocs(collection(db, ...base, 'exercises'));
  const exercises = exercisesSnap.docs.map(d => ({ ...d.data(), id: d.id }));

  const calendarSnap = await getDocs(collection(db, ...base, 'calendarSessions'));
  const calendarSessions = calendarSnap.docs.map(d => ({ ...d.data(), id: d.id }));

  return {
    version: 1,
    exportDate: new Date().toISOString(),
    profile,
    teams,
    members,
    trainings,
    exercises,
    calendarSessions,
  };
}

// ─── Import ────────────────────────────────────────────────────────────────

export async function importUserData(data, { uid, db, appId }) {
  const base = ['artifacts', appId, 'users', uid];

  if (data.profile && Object.keys(data.profile).length > 0) {
    const { updatedAt, createdAt, ...rest } = data.profile;
    await setDoc(doc(db, ...base, 'profile', 'main'), rest, { merge: true });
  }

  for (const team of (data.teams || [])) {
    const { updatedAt, createdAt, ...rest } = team;
    await setDoc(doc(db, ...base, 'teams', team.id), rest, { merge: true });

    for (const member of (data.members?.[team.id] || [])) {
      const { updatedAt: u, createdAt: c, ...mRest } = member;
      await setDoc(doc(db, ...base, 'teams', team.id, 'members', member.id), mRest, { merge: true });
    }

    for (const training of (data.trainings?.[team.id] || [])) {
      const { updatedAt: u, createdAt: c, ...tRest } = training;
      await setDoc(doc(db, ...base, 'teams', team.id, 'trainings', training.id), tRest, { merge: true });
    }
  }

  for (const ex of (data.exercises || [])) {
    const { updatedAt, createdAt, ...rest } = ex;
    await setDoc(doc(db, ...base, 'exercises', ex.id), rest, { merge: true });
  }

  for (const s of (data.calendarSessions || [])) {
    const { updatedAt, createdAt, ...rest } = s;
    await setDoc(doc(db, ...base, 'calendarSessions', s.id), rest, { merge: true });
  }
}

// ─── Delete all data ───────────────────────────────────────────────────────

export async function deleteAllUserData(uid, db, appId) {
  const base = ['artifacts', appId, 'users', uid];

  const teamsSnap = await getDocs(collection(db, ...base, 'teams'));
  for (const teamDoc of teamsSnap.docs) {
    const mSnap = await getDocs(collection(db, ...base, 'teams', teamDoc.id, 'members'));
    await Promise.all(mSnap.docs.map(d => deleteDoc(d.ref)));
    const tSnap = await getDocs(collection(db, ...base, 'teams', teamDoc.id, 'trainings'));
    await Promise.all(tSnap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(teamDoc.ref);
  }

  const exSnap = await getDocs(collection(db, ...base, 'exercises'));
  await Promise.all(exSnap.docs.map(d => deleteDoc(d.ref)));

  const calSnap = await getDocs(collection(db, ...base, 'calendarSessions'));
  await Promise.all(calSnap.docs.map(d => deleteDoc(d.ref)));

  await deleteDoc(doc(db, ...base, 'profile', 'main'));
}
