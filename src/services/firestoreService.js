import { doc, setDoc } from 'firebase/firestore';
import { userDocRef } from './firestoreHelpers';
import logger from '../utils/logger';

export const toFirestore = (bracket, forShared = false) => {
  // eslint-disable-next-line no-unused-vars
  const { myTeam, isShared, isSharedRef, exportVersion, ...clean } = bracket;
  if (forShared) return clean;
  return { ...clean, myTeam: myTeam || null };
};

export const saveBracketToFirestore = async (bracket, updatedBracket, { user, db, appId, onError }) => {
  if (!user || !db) return;
  try {
    if (bracket.shareCode) {
      await setDoc(doc(db, 'artifacts', appId, 'shared', bracket.shareCode), toFirestore(updatedBracket, true));
      if (updatedBracket.myTeam !== undefined) {
        setDoc(
          userDocRef(db, appId, user.uid, 'brackets', updatedBracket.id),
          { myTeam: updatedBracket.myTeam || null },
          { merge: true },
        ).catch((e) => logger.warn('Error guardando myTeam en shared bracket', e));
      }
    } else {
      await setDoc(userDocRef(db, appId, user.uid, 'brackets', updatedBracket.id), toFirestore(updatedBracket));
    }
  } catch (e) {
    logger.error('Error guardando en la nube', e);
    if (onError) onError('No se pudo guardar en la nube. Comprueba tu conexión.');
  }
};
