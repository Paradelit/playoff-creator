import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToProfile } from '../services/settingsService';

/**
 * Subscribe to the current user's profile.
 * Returns { profile, loading }.
 */
export function useProfile() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToProfile(user.uid, db, appId, (data) => {
      setProfile(data);
      setLoading(false);
    });
  }, [user, db, appId]);

  return { profile, loading };
}
