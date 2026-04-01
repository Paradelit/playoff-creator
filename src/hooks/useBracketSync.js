import { useState, useRef, useEffect, useMemo } from 'react';
import { doc, setDoc, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { userDocRef, userColRef } from '../services/firestoreHelpers';
import logger from '../utils/logger';
import { toFirestore } from '../services/firestoreService';
import { teamDisplayName } from '../screens/TeamsScreen';

export function useBracketSync({
  user,
  db,
  appId,
  initialShareCode,
  initialTeamId,
  onShareCodeConsumed,
  appMode,
  setAppMode,
}) {
  const [brackets, setBrackets] = useState([]);
  const [activeBracketId, setActiveBracketId] = useState(null);
  const activeBracket = useMemo(() => brackets.find((b) => b.id === activeBracketId), [brackets, activeBracketId]);

  const _scfg = activeBracket?.shareConfig;
  const canEdit =
    !_scfg ||
    _scfg.ownerId === user?.uid ||
    (user?.email && _scfg.invites?.[user.email] === 'edit') ||
    _scfg.linkAccess === 'edit';

  const [pendingShareCode, setPendingShareCode] = useState(initialShareCode || null);
  const [bracketToDelete, setBracketToDelete] = useState(null);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardSort, setDashboardSort] = useState('recent');

  const sharedUnsubscribers = useRef({});
  const isFirstSnapshot = useRef(true);
  const fileInputImport = useRef(null);

  // Persistir appMode en localStorage
  useEffect(() => {
    if (appMode === 'dashboard' || appMode === 'bracket' || appMode === 'upload') {
      localStorage.setItem('playoffs:lastAppMode', appMode);
    }
  }, [appMode]);

  // Sincronizacion Firestore principal
  useEffect(() => {
    if (!user || !db) return;
    const bracketsRef = userColRef(db, appId, user.uid, 'brackets');
    isFirstSnapshot.current = true;
    const unsubscribe = onSnapshot(
      bracketsRef,
      (snapshot) => {
        const fetchedBrackets = snapshot.docs.map((doc) => doc.data());
        const sorted = fetchedBrackets.sort((a, b) => b.createdAt - a.createdAt);
        setBrackets((prev) => {
          return sorted.map((b) => {
            const existing = prev.find((p) => p.id === b.id);
            if (existing && b.shareCode)
              return { ...existing, shareCode: b.shareCode, isSharedRef: existing.isSharedRef };
            return existing?.myTeam ? { ...b, myTeam: existing.myTeam } : b;
          });
        });
        if (isFirstSnapshot.current) {
          isFirstSnapshot.current = false;
          if (initialTeamId) {
            const teamBrackets = sorted.filter((b) => b.teamId === initialTeamId);
            if (teamBrackets.length === 1) {
              setActiveBracketId(teamBrackets[0].id);
              localStorage.setItem('playoffs:lastActiveBracketId', teamBrackets[0].id);
              setAppMode('bracket');
            } else if (teamBrackets.length > 1) {
              setDashboardSearch(teamBrackets[0].teamName || '');
              setAppMode('dashboard');
            } else {
              setAppMode('upload');
            }
          } else {
            const lastMode = localStorage.getItem('playoffs:lastAppMode') || 'dashboard';
            const lastId = localStorage.getItem('playoffs:lastActiveBracketId');
            if (lastMode === 'bracket' && lastId && sorted.find((b) => b.id === lastId)) {
              setActiveBracketId(lastId);
              setAppMode('bracket');
            } else {
              setAppMode('dashboard');
            }
          }
        }
      },
      (error) => {
        logger.error('Error sincronizando desde Firestore', error);
      },
    );
    return () => unsubscribe();
  }, [user]);

  // Suscripcion a cuadros compartidos
  useEffect(() => {
    if (!db) return;
    const sharedRefs = brackets.filter((b) => b.shareCode);
    sharedRefs.forEach((b) => {
      if (sharedUnsubscribers.current[b.shareCode]) return;
      const unsub = onSnapshot(doc(db, 'artifacts', appId, 'shared', b.shareCode), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setBrackets((prev) =>
          prev.map((pb) =>
            pb.shareCode === b.shareCode
              ? {
                  ...data,
                  isShared: true,
                  isSharedRef: pb.isSharedRef,
                  id: pb.id,
                  myTeam: pb.myTeam,
                  teamId: pb.teamId,
                  teamName: pb.teamName,
                }
              : pb,
          ),
        );
      });
      sharedUnsubscribers.current[b.shareCode] = unsub;
    });
    return () => {};
  }, [brackets.map((b) => b.shareCode).join(',')]);

  // Auto-abrir cuadro compartido
  useEffect(() => {
    if (!pendingShareCode || !user || !db || appMode === 'loading') return;
    const existing = brackets.find((b) => b.shareCode === pendingShareCode);
    if (existing) {
      setActiveBracketId(existing.id); // eslint-disable-line react-hooks/set-state-in-effect
      localStorage.setItem('playoffs:lastActiveBracketId', existing.id);
      setAppMode('bracket');
      setPendingShareCode(null);
      onShareCodeConsumed?.();
      return;
    }
    getDoc(doc(db, 'artifacts', appId, 'shared', pendingShareCode))
      .then((snap) => {
        if (!snap.exists()) {
          alert('El enlace no es válido o el cuadro no existe.');
          setPendingShareCode(null);
          onShareCodeConsumed?.();
          return;
        }
        const data = snap.data();
        const cfg = data.shareConfig || {};
        const hasAccess =
          cfg.ownerId === user.uid ||
          cfg.linkAccess === 'view' ||
          cfg.linkAccess === 'edit' ||
          (user.email && cfg.invites?.[user.email]);
        if (!hasAccess) {
          alert('No tienes acceso a este cuadro compartido.');
          setPendingShareCode(null);
          onShareCodeConsumed?.();
          return;
        }
        const bookmarkId = `shared_${pendingShareCode}`;
        const bookmark = {
          ...data,
          id: bookmarkId,
          isSharedRef: true,
          isShared: true,
          shareCode: pendingShareCode,
          createdAt: Date.now(),
          myTeam: undefined,
        };
        setBrackets((prev) => [bookmark, ...prev.filter((b) => b.id !== bookmarkId)]);
        if (!user.isAnonymous) {
          setDoc(userDocRef(db, appId, user.uid, 'brackets', bookmarkId), {
            id: bookmarkId,
            isSharedRef: true,
            shareCode: pendingShareCode,
            name: data.name,
            tournamentNameDetected: data.tournamentNameDetected || '',
            createdAt: bookmark.createdAt,
          }).catch((e) => logger.warn('Error guardando bookmark compartido', e));
        }
        setActiveBracketId(bookmarkId);
        localStorage.setItem('playoffs:lastActiveBracketId', bookmarkId);
        setAppMode('bracket');
        setPendingShareCode(null);
        onShareCodeConsumed?.();
      })
      .catch(() => {
        alert('Error al acceder al cuadro. Inténtalo de nuevo.');
        setPendingShareCode(null);
        onShareCodeConsumed?.();
      });
  }, [pendingShareCode, user, appMode]);

  // Handlers
  const handleDeleteBracket = (idToDelete) => setBracketToDelete(idToDelete);

  const confirmDelete = async () => {
    if (bracketToDelete) {
      const bracketBeingDeleted = brackets.find((b) => b.id === bracketToDelete);
      if (bracketBeingDeleted?.shareCode && sharedUnsubscribers.current[bracketBeingDeleted.shareCode]) {
        sharedUnsubscribers.current[bracketBeingDeleted.shareCode]();
        delete sharedUnsubscribers.current[bracketBeingDeleted.shareCode];
      }
      setBrackets((prev) => prev.filter((b) => b.id !== bracketToDelete));
      if (user && db) {
        await deleteDoc(userDocRef(db, appId, user.uid, 'brackets', bracketToDelete));
      }
      setBracketToDelete(null);
    }
  };

  const handleExport = (bracket) => {
    const exportData = { ...bracket, myTeam: undefined, exportVersion: 1 };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bracket.name.replace(/[^a-z0-9áéíóúñ ]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.bracketData || !data.name) {
        alert('El archivo no es un cuadro válido.');
        return;
      }
      const imported = {
        ...data,
        id: Date.now().toString(),
        createdAt: Date.now(),
        name: data.name,
        myTeam: undefined,
        exportVersion: undefined,
      };
      setBrackets((prev) => [imported, ...prev]);
      if (user && db) {
        setDoc(userDocRef(db, appId, user.uid, 'brackets', imported.id), toFirestore(imported)).catch((e) =>
          logger.warn('No se pudo guardar importación en la nube', e),
        );
      }
    } catch {
      alert('Error al leer el archivo. Asegúrate de que es un cuadro exportado válido.');
    }
  };

  const handleLinkTeam = (bracketId, team) => {
    const displayName = teamDisplayName(team);
    setBrackets((prev) => prev.map((b) => (b.id === bracketId ? { ...b, teamId: team.id, teamName: displayName } : b)));
    if (user && db) {
      setDoc(
        userDocRef(db, appId, user.uid, 'brackets', bracketId),
        { teamId: team.id, teamName: displayName },
        { merge: true },
      ).catch((e) => logger.warn('Error vinculando equipo', e));
    }
  };

  const handleUnlinkTeam = (bracketId) => {
    setBrackets((prev) => prev.map((b) => (b.id === bracketId ? { ...b, teamId: null, teamName: null } : b)));
    if (user && db) {
      setDoc(
        userDocRef(db, appId, user.uid, 'brackets', bracketId),
        { teamId: null, teamName: null },
        { merge: true },
      ).catch((e) => logger.warn('Error desvinculando equipo', e));
    }
  };

  return {
    brackets,
    setBrackets,
    activeBracketId,
    setActiveBracketId,
    activeBracket,
    canEdit,
    bracketToDelete,
    setBracketToDelete,
    confirmDelete,
    dashboardSearch,
    setDashboardSearch,
    dashboardSort,
    setDashboardSort,
    handleDeleteBracket,
    handleExport,
    handleImport,
    handleLinkTeam,
    handleUnlinkTeam,
    fileInputImport,
  };
}
