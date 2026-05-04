import { useEffect, useState } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { createMembersService } from '../services/membersService';

// Estados: 'idle' | 'loading' | 'needsAuth' | 'success' | 'notFound' | 'expired' | 'alreadyMember' | 'error'
export function useAcceptInvite({ wsId, inviteId, autoAccept = true }) {
  const { app, db, appId } = useFirebase();
  const { user, authReady } = useAuth();
  const [state, setState] = useState({
    status: 'loading',
    workspaceName: null,
    mismatched: false,
    error: null,
  });

  useEffect(() => {
    if (!authReady || !db || !appId || !wsId || !inviteId) return;
    let cancelled = false;

    (async () => {
      try {
        const inviteSnap = await getDoc(doc(db, 'artifacts', appId, 'workspaces', wsId, 'invites', inviteId));
        if (cancelled) return;

        if (!user) {
          setState({ status: 'needsAuth', workspaceName: null, mismatched: false, error: null });
          return;
        }
        if (!inviteSnap.exists()) {
          setState({ status: 'notFound', workspaceName: null, mismatched: false, error: null });
          return;
        }

        const wsSnap = await getDoc(doc(db, 'artifacts', appId, 'workspaces', wsId));
        const workspaceName = wsSnap.exists() ? wsSnap.data().name : null;
        if (cancelled) return;

        if (!autoAccept) {
          setState({ status: 'idle', workspaceName, mismatched: false, error: null });
          return;
        }

        const svc = createMembersService({ app });
        try {
          const r = await svc.acceptInvite({ wsId, inviteId });
          const inviteEmail = inviteSnap.data().inviteEmail;
          const mismatched = inviteEmail && inviteEmail !== (user.email || '');
          setState({
            status: 'success',
            workspaceName,
            mismatched: !!mismatched,
            error: null,
            claimedWsId: r.wsId,
          });
        } catch (err) {
          if (cancelled) return;
          const code = err?.code || '';
          if (code === 'functions/not-found')
            setState({ status: 'notFound', workspaceName, mismatched: false, error: null });
          else if (code === 'functions/failed-precondition')
            setState({ status: 'expired', workspaceName, mismatched: false, error: null });
          else if (code === 'functions/already-exists')
            setState({ status: 'alreadyMember', workspaceName, mismatched: false, error: null });
          else
            setState({
              status: 'error',
              workspaceName,
              mismatched: false,
              error: err?.message || 'Error inesperado',
            });
        }
      } catch (err) {
        if (!cancelled)
          setState({
            status: 'error',
            workspaceName: null,
            mismatched: false,
            error: err?.message || 'Error inesperado',
          });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, app, db, appId, user, wsId, inviteId, autoAccept]);

  return state;
}
