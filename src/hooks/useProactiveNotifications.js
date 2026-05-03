import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * Subscribes to unread proactive notifications for the current user, scoped
 * to the active workspace via a `wsId` filter.
 *
 * Notifications are stored under `users/{uid}/proactiveNotifications` (user-
 * private), but each notif now carries a `wsId` field so multiple workspaces
 * coexist for the same user.
 *
 * Returns:
 *   notifications — array of unread notification docs (most recent first, max 5)
 *   markAsRead(id) — marks a single notification as read in Firestore
 *   dismissAll() — marks all current notifications as read
 */
export function useProactiveNotifications() {
  const { db, appId } = useFirebase();
  const { user } = useAuth();
  const { activeWsId } = useWorkspace();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!db || !appId || !user?.uid || !activeWsId) {
      setNotifications([]);
      return;
    }

    const uid = user.uid;
    const colRef = collection(db, 'artifacts', appId, 'users', uid, 'proactiveNotifications');
    const q = query(
      colRef,
      where('wsId', '==', activeWsId),
      where('read', '==', false),
      orderBy('generatedAt', 'desc'),
      limit(5),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setNotifications(docs);
      },
      (_err) => {
        // Silently ignore — notifications are optional and non-critical
        setNotifications([]);
      },
    );

    return unsub;
  }, [db, appId, user?.uid, activeWsId]);

  async function markAsRead(notifId) {
    if (!db || !appId || !user?.uid) return;
    try {
      const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'proactiveNotifications', notifId);
      await updateDoc(ref, { read: true });
    } catch {
      // Non-critical — ignore
    }
  }

  async function dismissAll() {
    await Promise.all(notifications.map((n) => markAsRead(n.id)));
  }

  return { notifications, markAsRead, dismissAll };
}
