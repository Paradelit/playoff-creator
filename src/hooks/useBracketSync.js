import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { userDocRef, userColRef } from '../services/firestoreHelpers';
import { deleteBracketCascade } from '../services/dataCleanupService';
import logger from '../utils/logger';
import { teamDisplayName } from '../utils/teamUtils';
import { useToast } from '../contexts/ToastContext';
import { mergeBracketsWithPrevious, useSharedBracketSubscriptions } from './useSharedBrackets';

export function useBracketSync({
  user,
  db,
  appId,
  initialShareCode,
  initialTeamId,
  onShareCodeConsumed,
  appMode,
  setAppMode,
  setPendingBracket,
  setPreviewZoom,
}) {
  const toast = useToast();
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
  const shareCodes = useMemo(() => brackets.filter((b) => b.shareCode).map((b) => b.shareCode), [brackets]);

  const isFirstSnapshot = useRef(true);
  const fileInputImport = useRef(null);

  // Persistir appMode en localStorage
  useEffect(() => {
    if (appMode === 'dashboard' || appMode === 'bracket' || appMode === 'upload') {
      localStorage.setItem('playoffs:lastAppMode', appMode);
    }
  }, [appMode]);

  const mergeBracketSnapshot = useCallback(
    (fetchedBrackets, previousBrackets) =>
      mergeBracketsWithPrevious(fetchedBrackets, previousBrackets, (bracket, existing) => {
        if (bracket.shareCode) {
          return { ...existing, shareCode: bracket.shareCode, isSharedRef: existing.isSharedRef };
        }
        if (existing.myTeam) {
          return { ...bracket, myTeam: existing.myTeam };
        }
        return bracket;
      }),
    [],
  );

  const handleSharedSnapshot = useCallback((code, data) => {
    setBrackets((prev) =>
      prev.map((bracket) =>
        bracket.shareCode === code
          ? {
              ...data,
              isShared: true,
              isSharedRef: bracket.isSharedRef,
              id: bracket.id,
              myTeam: bracket.myTeam,
              teamId: bracket.teamId,
              teamName: bracket.teamName,
            }
          : bracket,
      ),
    );
  }, []);

  const { unsubscribeShareCode } = useSharedBracketSubscriptions({
    db,
    appId,
    shareCodes,
    onSharedSnapshot: handleSharedSnapshot,
  });

  const resetPendingShare = useCallback(() => {
    setPendingShareCode(null);
    onShareCodeConsumed?.();
  }, [onShareCodeConsumed]);

  // Sincronizacion Firestore principal
  useEffect(() => {
    if (!user || !db) return undefined;
    const bracketsRef = userColRef(db, appId, user.uid, 'brackets');
    isFirstSnapshot.current = true;
    const unsubscribe = onSnapshot(
      bracketsRef,
      (snapshot) => {
        const fetchedBrackets = snapshot.docs.map((snapDoc) => snapDoc.data());
        const sorted = fetchedBrackets.sort((a, b) => b.createdAt - a.createdAt);
        setBrackets((prev) => mergeBracketSnapshot(sorted, prev));
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
  }, [appId, db, initialTeamId, mergeBracketSnapshot, setAppMode, user]);

  // Auto-abrir cuadro compartido
  useEffect(() => {
    if (!pendingShareCode || !user || !db || appMode === 'loading') return undefined;
    const existing = brackets.find((b) => b.shareCode === pendingShareCode);
    if (existing) {
      localStorage.setItem('playoffs:lastActiveBracketId', existing.id);
      queueMicrotask(() => {
        setActiveBracketId(existing.id);
        setAppMode('bracket');
        resetPendingShare();
      });
      return undefined;
    }
    getDoc(doc(db, 'artifacts', appId, 'shared', pendingShareCode))
      .then((snap) => {
        if (!snap.exists()) {
          toast('El enlace no es válido o el cuadro no existe.', 'error');
          resetPendingShare();
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
          toast('No tienes acceso a este cuadro compartido.', 'warning');
          resetPendingShare();
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
        resetPendingShare();
      })
      .catch(() => {
        toast('Error al acceder al cuadro. Inténtalo de nuevo.', 'error');
        resetPendingShare();
      });
    return undefined;
  }, [appId, appMode, brackets, db, pendingShareCode, resetPendingShare, setAppMode, toast, user]);

  // Handlers
  const handleDeleteBracket = (idToDelete) => setBracketToDelete(idToDelete);

  const confirmDelete = async () => {
    if (bracketToDelete) {
      const bracketBeingDeleted = brackets.find((b) => b.id === bracketToDelete);
      if (bracketBeingDeleted?.shareCode) {
        unsubscribeShareCode(bracketBeingDeleted.shareCode);
      }
      setBrackets((prev) => prev.filter((b) => b.id !== bracketToDelete));
      if (user && db) {
        await deleteBracketCascade({ appId, bracketId: bracketToDelete });
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
        toast('El archivo no es un cuadro válido.', 'error');
        return;
      }
      const imported = {
        ...data,
        id: Date.now().toString(),
        createdAt: Date.now(),
        name: data.name,
        myTeam: undefined,
        exportVersion: undefined,
        shareCode: undefined,
        shareConfig: undefined,
        isShared: undefined,
        isSharedRef: undefined,
      };
      setPendingBracket?.(imported);
      setPreviewZoom?.(0.7);
      setAppMode('preview');
    } catch {
      toast('Error al leer el archivo. Asegúrate de que es un cuadro exportado válido.', 'error');
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
