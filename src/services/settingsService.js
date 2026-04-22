import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { saveMember } from './teamsService';
import { deleteAllUserDataCascade } from './dataCleanupService';

// Re-export backup functions so existing consumers don't break
export { exportUserData, importUserData } from './backupService';

function profileDoc(uid, db, appId) {
  return doc(db, 'artifacts', appId, 'users', uid, 'profile', 'main');
}

export function subscribeToProfile(uid, db, appId, callback) {
  return onSnapshot(profileDoc(uid, db, appId), (snap) => {
    callback(snap.exists() ? snap.data() : {});
  });
}

export async function saveProfile(profile, { uid, db, appId }) {
  await setDoc(
    profileDoc(uid, db, appId),
    {
      ...profile,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function uploadLogoClub(file, { uid, storage, db, appId }) {
  const storageRef = ref(storage, `users/${uid}/logo-club`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await saveProfile({ logoClub: url }, { uid, db, appId });
  return url;
}

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

export async function deleteAllUserData(uid, db, appId) {
  await deleteAllUserDataCascade({ appId });
}
