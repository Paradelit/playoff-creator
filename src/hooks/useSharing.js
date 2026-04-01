import { useState, useRef, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { userDocRef } from '../services/firestoreHelpers';
import logger from '../utils/logger';
import { getUserColor } from '../utils/cursorUtils';
import { toFirestore } from '../services/firestoreService';

export function useSharing({ user, db, appId, setBrackets, activeBracket, appMode, mainRef }) {
  const [sharingBracket, setSharingBracket] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState('view');
  const [remoteCursors, setRemoteCursors] = useState({});
  const cursorThrottleRef = useRef(null);

  // Cursores en tiempo real
  useEffect(() => {
    if (appMode !== 'bracket' || !activeBracket?.shareCode || !user || !db) return;
    const shareCode = activeBracket.shareCode;
    const cursorsCol = collection(db, 'artifacts', appId, 'presence', shareCode, 'cursors');
    const unsub = onSnapshot(
      cursorsCol,
      (snap) => {
        const now = Date.now();
        const cursors = {};
        snap.docs.forEach((d) => {
          if (d.id === user.uid) return;
          const data = d.data();
          if (now - data.ts < 5000) cursors[d.id] = data;
        });
        setRemoteCursors(cursors);
      },
      () => {},
    );
    const mainEl = mainRef.current;
    if (!mainEl) return () => unsub();
    const handleMouseMove = (e) => {
      if (cursorThrottleRef.current) return;
      cursorThrottleRef.current = setTimeout(() => {
        cursorThrottleRef.current = null;
      }, 400);
      const rect = mainEl.getBoundingClientRect();
      const x = (e.clientX - rect.left + mainEl.scrollLeft) / Math.max(mainEl.scrollWidth, 1);
      const y = (e.clientY - rect.top + mainEl.scrollTop) / Math.max(mainEl.scrollHeight, 1);
      setDoc(doc(db, 'artifacts', appId, 'presence', shareCode, 'cursors', user.uid), {
        x,
        y,
        name: user.displayName || user.email || 'Usuario',
        color: getUserColor(user.uid),
        ts: Date.now(),
      }).catch((e) => logger.warn('Error enviando cursor', e));
    };
    const removeCursor = () => {
      deleteDoc(doc(db, 'artifacts', appId, 'presence', shareCode, 'cursors', user.uid)).catch((e) =>
        logger.warn('Error eliminando cursor', e),
      );
    };
    mainEl.addEventListener('mousemove', handleMouseMove);
    mainEl.addEventListener('mouseleave', removeCursor);
    return () => {
      mainEl.removeEventListener('mousemove', handleMouseMove);
      mainEl.removeEventListener('mouseleave', removeCursor);
      unsub();
      removeCursor();
      setRemoteCursors({});
      if (cursorThrottleRef.current) {
        clearTimeout(cursorThrottleRef.current);
        cursorThrottleRef.current = null;
      }
    };
  }, [appMode, activeBracket?.shareCode, user?.uid]);

  const handleShare = async (bracket) => {
    if (!db) return;
    let finalBracket = bracket;
    if (!bracket.shareCode || !bracket.shareConfig) {
      const shareCode = bracket.shareCode || Math.random().toString(36).slice(2, 8).toUpperCase();
      const shareConfig = {
        ownerId: user?.uid || 'anon',
        ownerEmail: user?.email || null,
        ownerName: user?.displayName || user?.email || 'Usuario',
        linkAccess: 'edit',
        invites: {},
      };
      if (!bracket.shareCode) {
        const sharedDoc = { ...toFirestore({ ...bracket, shareCode }, true), shareConfig };
        await setDoc(doc(db, 'artifacts', appId, 'shared', shareCode), sharedDoc);
      } else {
        await setDoc(doc(db, 'artifacts', appId, 'shared', shareCode), { shareConfig }, { merge: true });
      }
      finalBracket = { ...bracket, shareCode, shareConfig };
      setBrackets((prev) => prev.map((b) => (b.id === bracket.id ? finalBracket : b)));
      if (user) {
        setDoc(userDocRef(db, appId, user.uid, 'brackets', bracket.id), toFirestore(finalBracket)).catch((e) =>
          logger.warn('Error guardando shareCode', e),
        );
      }
    }
    setSharingBracket(finalBracket);
  };

  const handleUpdateShareConfig = async (updates) => {
    if (!sharingBracket?.shareCode) return;
    const newConfig = { ...sharingBracket.shareConfig, ...updates };
    const updated = { ...sharingBracket, shareConfig: newConfig };
    setSharingBracket(updated);
    setBrackets((prev) => prev.map((b) => (b.id === sharingBracket.id ? updated : b)));
    await setDoc(
      doc(db, 'artifacts', appId, 'shared', sharingBracket.shareCode),
      { shareConfig: newConfig },
      { merge: true },
    );
    if (user)
      setDoc(
        userDocRef(db, appId, user.uid, 'brackets', sharingBracket.id),
        { shareConfig: newConfig },
        { merge: true },
      ).catch((e) => logger.warn('Error guardando shareConfig local', e));
  };

  const handleAddInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@') || !sharingBracket?.shareConfig) return;
    const newInvites = { ...sharingBracket.shareConfig.invites, [email]: invitePermission };
    await handleUpdateShareConfig({ invites: newInvites });
    setInviteEmail('');
  };

  const handleRemoveInvite = async (email) => {
    if (!sharingBracket?.shareConfig) return;
    const newInvites = { ...sharingBracket.shareConfig.invites };
    delete newInvites[email];
    await handleUpdateShareConfig({ invites: newInvites });
  };

  return {
    sharingBracket,
    setSharingBracket,
    copiedCode,
    setCopiedCode,
    inviteEmail,
    setInviteEmail,
    invitePermission,
    setInvitePermission,
    remoteCursors,
    handleShare,
    handleUpdateShareConfig,
    handleAddInvite,
    handleRemoveInvite,
  };
}
