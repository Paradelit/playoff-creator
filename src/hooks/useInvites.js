import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';

export function useInvites(wsId) {
  const { db, appId } = useFirebase();
  const [state, setState] = useState({ invites: [], loading: true });

  useEffect(() => {
    if (!db || !appId || !wsId) {
      setState({ invites: [], loading: false });
      return;
    }
    const ref = collection(db, 'artifacts', appId, 'workspaces', wsId, 'invites');
    const unsub = onSnapshot(
      ref,
      (snap) => setState({ invites: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      (err) => {
        console.error('[useInvites]', err);
        setState({ invites: [], loading: false });
      },
    );
    return unsub;
  }, [db, appId, wsId]);

  return state;
}
