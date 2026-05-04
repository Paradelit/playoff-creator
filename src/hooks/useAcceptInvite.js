import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';
import { useAuth } from '../contexts/AuthContext';
import { createMembersService } from '../services/membersService';

// Estados: 'idle' | 'loading' | 'needsAuth' | 'success' | 'notFound' | 'expired' | 'alreadyMember' | 'error'
//
// Nota arquitectural: el claimer NO es miembro del workspace hasta que la
// callable acceptInvite se ejecuta con éxito. Por eso las rules le bloquean
// leer el invite doc directamente — el callable es la única vía. Este hook
// confía en los códigos de error de HttpsError para distinguir notFound /
// expired / alreadyMember en vez de hacer lecturas previas.
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
    if (!authReady || !wsId || !inviteId) return;
    let cancelled = false;

    (async () => {
      if (!user) {
        if (!cancelled) setState({ status: 'needsAuth', workspaceName: null, mismatched: false, error: null });
        return;
      }

      if (!autoAccept) {
        if (!cancelled) setState({ status: 'idle', workspaceName: null, mismatched: false, error: null });
        return;
      }

      const svc = createMembersService({ app });
      try {
        const r = await svc.acceptInvite({ wsId, inviteId });
        if (cancelled) return;
        // Tras claim, el user ya es miembro y puede leer el workspace doc.
        let workspaceName = null;
        try {
          const wsSnap = await getDoc(doc(db, 'artifacts', appId, 'workspaces', wsId));
          if (wsSnap.exists()) workspaceName = wsSnap.data().name ?? null;
        } catch {
          /* ignore — name es decorativo */
        }
        if (cancelled) return;
        setState({
          status: 'success',
          workspaceName,
          // Sin mismatched detection (necesitaría leer el invite doc, que ya
          // fue borrado por la transacción). El miembro recién creado lleva
          // el flag mismatchedEmailHint si aplica; quien quiera enseñarlo lo
          // verá en la pantalla de miembros.
          mismatched: false,
          error: null,
          claimedWsId: r.wsId,
        });
      } catch (err) {
        if (cancelled) return;
        const code = err?.code || '';
        if (code === 'functions/not-found')
          setState({ status: 'notFound', workspaceName: null, mismatched: false, error: null });
        else if (code === 'functions/failed-precondition')
          setState({ status: 'expired', workspaceName: null, mismatched: false, error: null });
        else if (code === 'functions/already-exists')
          setState({ status: 'alreadyMember', workspaceName: null, mismatched: false, error: null });
        else
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
