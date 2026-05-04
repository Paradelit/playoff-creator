import { useEffect, useState } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useAuth } from '../contexts/AuthContext';
import { createMembersService } from '../services/membersService';

export function useClubAllowlist() {
  const { app } = useFirebase();
  const { user } = useAuth();
  const [state, setState] = useState({ allowed: false, loading: true });

  useEffect(() => {
    if (!app || !user?.uid) {
      setState({ allowed: false, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const svc = createMembersService({ app });
        const { allowed } = await svc.getClubAllowlistStatus();
        if (!cancelled) setState({ allowed: !!allowed, loading: false });
      } catch (err) {
        console.error('[useClubAllowlist]', err);
        if (!cancelled) setState({ allowed: false, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app, user?.uid]);

  return state;
}
