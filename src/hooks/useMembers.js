import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';

export function useMembers(wsId) {
  const { db, appId } = useFirebase();
  const [state, setState] = useState({ members: [], loading: true });

  useEffect(() => {
    if (!db || !appId || !wsId) {
      setState({ members: [], loading: false });
      return;
    }
    const ref = collection(db, 'artifacts', appId, 'workspaces', wsId, 'members');
    const unsub = onSnapshot(
      ref,
      (snap) => setState({ members: snap.docs.map((d) => ({ uid: d.id, ...d.data() })), loading: false }),
      (err) => {
        console.error('[useMembers]', err);
        setState({ members: [], loading: false });
      },
    );
    return unsub;
  }, [db, appId, wsId]);

  return state;
}
