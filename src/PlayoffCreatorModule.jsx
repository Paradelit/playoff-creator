import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc } from 'firebase/firestore';

import { useAuth } from './contexts/AuthContext';
import { useFirebase } from './contexts/FirebaseContext';
import { buildDynamicBracket, calculateMatchWinner } from './utils/bracketEngine';
import { getUserColor } from './utils/cursorUtils';
import { extractTextFromFile, callGeminiForBracket, callGeminiForResults } from './services/aiService';
import { saveBracketToFirestore, toFirestore } from './services/firestoreService';

import LoadingScreen from './screens/LoadingScreen';
import DashboardScreen from './screens/DashboardScreen';
import UploadScreen from './screens/UploadScreen';
import PreviewScreen from './screens/PreviewScreen';
import BracketScreen from './screens/BracketScreen';

// Props:
//   initialShareCode   – share code extraído de la URL por el padre
//   onShareCodeConsumed – callback a llamar cuando el share code se ha procesado
//   shareUrlBase       – base para construir share URLs, ej: "https://app.com/s"
export default function PlayoffCreatorModule({ initialShareCode, onShareCodeConsumed, shareUrlBase }) {
  const { user, handleLogout: authLogout } = useAuth();
  const { db, appId } = useFirebase();
  const firebaseError = !db;

  const [appMode, setAppMode] = useState('loading');

  const [brackets, setBrackets] = useState([]);
  const [activeBracketId, setActiveBracketId] = useState(null);
  const activeBracket = useMemo(() => brackets.find(b => b.id === activeBracketId), [brackets, activeBracketId]);

  const _scfg = activeBracket?.shareConfig;
  const canEdit = !_scfg || _scfg.ownerId === user?.uid || (user?.email && _scfg.invites?.[user.email] === 'edit') || _scfg.linkAccess === 'edit';

  const [newBracketName, setNewBracketName] = useState('');
  const [basesFile, setBasesFile] = useState(null);
  const [clasifFile, setClasifFile] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');

  const [isProcessingResults, setIsProcessingResults] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showMobileTools, setShowMobileTools] = useState(false);
  const [bracketToDelete, setBracketToDelete] = useState(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [sharingBracket, setSharingBracket] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState('view');
  // Inicializado con el share code que pasa el padre (puede venir de la URL)
  const [pendingShareCode, setPendingShareCode] = useState(initialShareCode || null);

  const fileInputBases = useRef(null);
  const fileInputClasif = useRef(null);
  const fileInputResults = useRef(null);
  const fileInputImport = useRef(null);
  const isFirstSnapshot = useRef(true);
  const sharedUnsubscribers = useRef({});
  const mainRef = useRef(null);
  const hasCenteredRef = useRef({});
  const bracketExportRef = useRef(null);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState({});
  const cursorThrottleRef = useRef(null);

  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardSort, setDashboardSort] = useState('recent');
  const [pendingBracket, setPendingBracket] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(0.7);
  const historyRef = useRef({});
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editingBracketName, setEditingBracketName] = useState(false);
  const [bracketNameInput, setBracketNameInput] = useState('');

  // Persiste appMode en localStorage (con namespace del módulo)
  useEffect(() => {
    if (appMode === 'dashboard' || appMode === 'bracket' || appMode === 'upload') {
      localStorage.setItem('playoffs:lastAppMode', appMode);
    }
  }, [appMode]);

  // Limpiar modales, mensajes e inputs al cambiar de pantalla
  useEffect(() => {
    setShowMobileTools(false);
    setSharingBracket(null);
    setShowResetModal(false);
    setErrorMsg('');
    setEditingBracketName(false);
    if (fileInputBases?.current) fileInputBases.current.value = '';
    if (fileInputClasif?.current) fileInputClasif.current.value = '';
  }, [appMode]);

  // Cierra sesión y limpia el estado local
  const handleLogout = async () => {
    setBrackets([]);
    await authLogout();
  };

  // Sincronización Firestore
  useEffect(() => {
    if (!user || !db) return;
    const bracketsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'brackets');
    isFirstSnapshot.current = true;
    const unsubscribe = onSnapshot(bracketsRef, (snapshot) => {
      const fetchedBrackets = snapshot.docs.map(doc => doc.data());
      const sorted = fetchedBrackets.sort((a, b) => b.createdAt - a.createdAt);
      setBrackets(prev => {
        return sorted.map(b => {
          const existing = prev.find(p => p.id === b.id);
          if (existing && b.shareCode) return { ...existing, shareCode: b.shareCode, isSharedRef: existing.isSharedRef };
          return existing?.myTeam ? { ...b, myTeam: existing.myTeam } : b;
        });
      });
      if (isFirstSnapshot.current) {
        isFirstSnapshot.current = false;
        const lastMode = localStorage.getItem('playoffs:lastAppMode') || 'dashboard';
        const lastId = localStorage.getItem('playoffs:lastActiveBracketId');
        if (lastMode === 'bracket' && lastId && sorted.find(b => b.id === lastId)) {
          setActiveBracketId(lastId);
          setAppMode('bracket');
        } else {
          setAppMode('dashboard');
        }
      }
    }, (error) => {
      console.error("Error sincronizando desde Firestore:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Suscripción a cuadros compartidos
  useEffect(() => {
    if (!db) return;
    const sharedRefs = brackets.filter(b => b.shareCode);
    sharedRefs.forEach(b => {
      if (sharedUnsubscribers.current[b.shareCode]) return;
      const unsub = onSnapshot(
        doc(db, 'artifacts', appId, 'shared', b.shareCode),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          setBrackets(prev => prev.map(pb =>
            pb.shareCode === b.shareCode
              ? { ...data, isShared: true, isSharedRef: pb.isSharedRef, id: pb.id, myTeam: pb.myTeam }
              : pb
          ));
        }
      );
      sharedUnsubscribers.current[b.shareCode] = unsub;
    });
    return () => {};
  }, [brackets.map(b => b.shareCode).join(',')]);

  // Auto-abre cuadro compartido por share code
  useEffect(() => {
    if (!pendingShareCode || !user || !db || appMode === 'loading') return;
    const existing = brackets.find(b => b.shareCode === pendingShareCode);
    if (existing) {
      setActiveBracketId(existing.id);
      localStorage.setItem('playoffs:lastActiveBracketId', existing.id);
      setAppMode('bracket');
      setPendingShareCode(null);
      onShareCodeConsumed?.();
      return;
    }
    getDoc(doc(db, 'artifacts', appId, 'shared', pendingShareCode)).then(snap => {
      if (!snap.exists()) {
        alert('El enlace no es válido o el cuadro no existe.');
        setPendingShareCode(null);
        onShareCodeConsumed?.();
        return;
      }
      const data = snap.data();
      const cfg = data.shareConfig || {};
      const hasAccess = cfg.ownerId === user.uid
        || cfg.linkAccess === 'view' || cfg.linkAccess === 'edit'
        || (user.email && cfg.invites?.[user.email]);
      if (!hasAccess) {
        alert('No tienes acceso a este cuadro compartido.');
        setPendingShareCode(null);
        onShareCodeConsumed?.();
        return;
      }
      const bookmarkId = `shared_${pendingShareCode}`;
      const bookmark = { ...data, id: bookmarkId, isSharedRef: true, isShared: true, shareCode: pendingShareCode, createdAt: Date.now(), myTeam: undefined };
      setBrackets(prev => [bookmark, ...prev.filter(b => b.id !== bookmarkId)]);
      if (!user.isAnonymous) {
        setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', bookmarkId), {
          id: bookmarkId, isSharedRef: true, shareCode: pendingShareCode,
          name: data.name, tournamentNameDetected: data.tournamentNameDetected || '', createdAt: bookmark.createdAt,
        }).catch(() => {});
      }
      setActiveBracketId(bookmarkId);
      localStorage.setItem('playoffs:lastActiveBracketId', bookmarkId);
      setAppMode('bracket');
      setPendingShareCode(null);
      onShareCodeConsumed?.();
    }).catch(() => {
      alert('Error al acceder al cuadro. Inténtalo de nuevo.');
      setPendingShareCode(null);
      onShareCodeConsumed?.();
    });
  }, [pendingShareCode, user, appMode]);

  const handleProcessDocuments = async () => {
    if (!basesFile || !clasifFile) {
      setErrorMsg("Debes subir AMBOS documentos para que la IA los procese.");
      return;
    }
    if (!newBracketName.trim()) {
      setErrorMsg("Por favor, dale un nombre a este cuadro (ej. 'Liga VIPS Masculina').");
      return;
    }
    setErrorMsg('');
    setIsProcessing(true);
    setProcessStatus('Extrayendo documentos...');
    try {
      const basesText = await extractTextFromFile(basesFile);
      const clasifText = await extractTextFromFile(clasifFile);
      if (!basesText || !clasifText) throw new Error("No se pudo extraer texto.");

      if (basesText.length > 45000 || clasifText.length > 45000) {
        setProcessStatus('⚠️ El documento es muy extenso; solo se analizarán los primeros 45 KB. Si el resultado es incorrecto, usa el campo de contexto adicional.');
        await new Promise(r => setTimeout(r, 3000));
      }

      setProcessStatus('La IA está analizando minuciosamente los cruces y grupos...');
      const aiData = await callGeminiForBracket(basesText, clasifText, customPrompt, {
        onStatus: setProcessStatus,
        onError: setErrorMsg,
      });

      if (!aiData || !aiData.initialMatches) throw new Error("No se recibió información válida de la IA.");

      setProcessStatus('Generando Bracket Dinámico...');
      const bracketDynamicTree = buildDynamicBracket(aiData.initialMatches, aiData.rounds);

      const allTeamsSet = new Set();
      aiData.initialMatches.forEach(m => {
        if (m.team1) allTeamsSet.add(m.team1);
        if (m.team2) allTeamsSet.add(m.team2);
        if (m.team1Options) m.team1Options.forEach(t => allTeamsSet.add(t));
        if (m.team2Options) m.team2Options.forEach(t => allTeamsSet.add(t));
      });

      const newBracketObj = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        name: newBracketName.trim(),
        tournamentNameDetected: aiData.tournamentName,
        initialMatchesArray: aiData.initialMatches,
        roundsData: aiData.rounds || [],
        allTeams: Array.from(allTeamsSet).sort(),
        bracketData: bracketDynamicTree
      };

      setPendingBracket(newBracketObj);
      setPreviewZoom(0.7);
      setIsProcessing(false);
      setAppMode('preview');
    } catch (err) {
      console.error(err);
      if (err.message !== "RATE_LIMIT" && err.message !== "FORBIDDEN") {
        setErrorMsg(err.message || "Ocurrió un error inesperado al procesar los documentos.");
      }
      setIsProcessing(false);
    }
  };

  const handleConfirmBracket = () => {
    if (!pendingBracket) return;
    if (!pendingBracket.bracketData?.rootId || Object.keys(pendingBracket.bracketData?.state || {}).length === 0) {
      setErrorMsg('El cuadro generado no es válido. Inténtalo de nuevo.');
      setAppMode('upload');
      return;
    }
    setBrackets(prev => [pendingBracket, ...prev]);
    setActiveBracketId(pendingBracket.id);
    localStorage.setItem('playoffs:lastActiveBracketId', pendingBracket.id);
    if (user && db) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', pendingBracket.id), toFirestore(pendingBracket))
        .catch(e => console.warn("No se pudo guardar en la nube:", e));
    }
    setPendingBracket(null);
    setNewBracketName('');
    setBasesFile(null);
    setClasifFile(null);
    setCustomPrompt('');
    setAppMode('bracket');
  };

  const fireSave = (bracket, updatedBracket) => saveBracketToFirestore(bracket, updatedBracket, {
    user, db, appId,
    onError: (msg) => { setSaveError(msg); setTimeout(() => setSaveError(''), 4000); },
  });

  const updateActiveBracketData = async (updaterFn, skipHistory = false) => {
    const bracket = brackets.find(b => b.id === activeBracketId);
    if (!bracket) return;
    if (!skipHistory) {
      const h = historyRef.current[activeBracketId] || { undo: [], redo: [] };
      const newUndo = [...h.undo, bracket.bracketData].slice(-10);
      historyRef.current[activeBracketId] = { undo: newUndo, redo: [] };
      setCanUndo(true);
      setCanRedo(false);
    }
    const newBracketData = updaterFn(bracket.bracketData);
    const updatedBracket = { ...bracket, bracketData: newBracketData };
    setBrackets(prevBrackets => prevBrackets.map(b => b.id === activeBracketId ? updatedBracket : b));
    await fireSave(bracket, updatedBracket);
  };

  const handleUndo = async () => {
    const bracket = brackets.find(b => b.id === activeBracketId);
    if (!bracket) return;
    const h = historyRef.current[activeBracketId];
    if (!h?.undo?.length) return;
    const prevData = h.undo[h.undo.length - 1];
    const newUndo = h.undo.slice(0, -1);
    const newRedo = [...(h.redo || []), bracket.bracketData].slice(-10);
    historyRef.current[activeBracketId] = { undo: newUndo, redo: newRedo };
    setCanUndo(newUndo.length > 0);
    setCanRedo(true);
    const updatedBracket = { ...bracket, bracketData: prevData };
    setBrackets(prev => prev.map(b => b.id === activeBracketId ? updatedBracket : b));
    await fireSave(bracket, updatedBracket);
  };

  const handleRedo = async () => {
    const bracket = brackets.find(b => b.id === activeBracketId);
    if (!bracket) return;
    const h = historyRef.current[activeBracketId];
    if (!h?.redo?.length) return;
    const nextData = h.redo[h.redo.length - 1];
    const newRedo = h.redo.slice(0, -1);
    const newUndo = [...(h.undo || []), bracket.bracketData].slice(-10);
    historyRef.current[activeBracketId] = { undo: newUndo, redo: newRedo };
    setCanUndo(true);
    setCanRedo(newRedo.length > 0);
    const updatedBracket = { ...bracket, bracketData: nextData };
    setBrackets(prev => prev.map(b => b.id === activeBracketId ? updatedBracket : b));
    await fireSave(bracket, updatedBracket);
  };

  const clearForwardLocal = (stateDict, matchId, teamToClear) => {
    let currId = stateDict[matchId].nextId;
    let prevId = matchId;
    while (currId) {
      const slot = stateDict[prevId].slot;
      if (stateDict[currId][slot] === teamToClear) {
        stateDict[currId] = { ...stateDict[currId], [slot]: null };
        stateDict[currId].scores = stateDict[currId].scores.map(s => ({
          ...s, [slot === 'team1' ? 's1' : 's2']: ''
        }));
      }
      if (stateDict[currId].winner === teamToClear) {
        stateDict[currId] = { ...stateDict[currId], winner: null };
        prevId = currId;
        currId = stateDict[currId].nextId;
      } else break;
    }
  };

  const handleSorteoSelect = (matchId, teamIndex, selectedTeam) => {
    updateActiveBracketData(prevData => {
      const nextState = { ...prevData.state };
      const match = { ...nextState[matchId] };
      const oldTeam = teamIndex === 1 ? match.team1 : match.team2;
      if (teamIndex === 1) match.team1 = selectedTeam || null;
      else match.team2 = selectedTeam || null;
      if (oldTeam !== selectedTeam) {
        match.scores = match.scores.map(s => ({ ...s, [teamIndex === 1 ? 's1' : 's2']: '' }));
        if (match.winner === oldTeam || (match.winner && match.winner !== selectedTeam)) {
          clearForwardLocal(nextState, matchId, match.winner);
          match.winner = null;
        }
      }
      nextState[matchId] = match;
      return { ...prevData, state: nextState };
    });
  };

  const handleScoreChange = (matchId, teamIndex, gameIndex, value) => {
    updateActiveBracketData(prevData => {
      const nextState = { ...prevData.state };
      const match = { ...nextState[matchId] };
      const newScores = [...match.scores];
      newScores[gameIndex] = { ...newScores[gameIndex] };
      if (teamIndex === 1) newScores[gameIndex].s1 = value;
      else newScores[gameIndex].s2 = value;
      match.scores = newScores;
      const newWinner = calculateMatchWinner(match);
      const oldWinner = match.winner;
      match.winner = newWinner;
      nextState[matchId] = match;
      if (oldWinner !== newWinner) {
        if (oldWinner) clearForwardLocal(nextState, matchId, oldWinner);
        if (newWinner) {
          const nextId = match.nextId;
          if (nextId) {
            const slot = match.slot;
            nextState[nextId] = { ...nextState[nextId], [slot]: newWinner };
          }
        }
      }
      return { ...prevData, state: nextState };
    });
  };

  const confirmReset = () => {
    updateActiveBracketData(() => buildDynamicBracket(activeBracket.initialMatchesArray, activeBracket.roundsData));
    setShowResetModal(false);
  };

  const handleDeleteBracket = (idToDelete) => setBracketToDelete(idToDelete);

  const confirmDelete = async () => {
    if (bracketToDelete) {
      const bracketBeingDeleted = brackets.find(b => b.id === bracketToDelete);
      if (bracketBeingDeleted?.shareCode && sharedUnsubscribers.current[bracketBeingDeleted.shareCode]) {
        sharedUnsubscribers.current[bracketBeingDeleted.shareCode]();
        delete sharedUnsubscribers.current[bracketBeingDeleted.shareCode];
      }
      delete historyRef.current[bracketToDelete];
      setBrackets(prev => prev.filter(b => b.id !== bracketToDelete));
      if (user && db) {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', bracketToDelete));
      }
      setBracketToDelete(null);
    }
  };

  // Resetear undo/redo al cambiar de cuadro
  useEffect(() => {
    if (activeBracketId) delete hasCenteredRef.current[activeBracketId];
    const h = historyRef.current[activeBracketId];
    setCanUndo(!!(h?.undo?.length));
    setCanRedo(!!(h?.redo?.length));
  }, [activeBracketId]);

  // Atajos Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (appMode !== 'bracket' || !canEdit) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, canEdit, canUndo, canRedo]);

  const findTargetMatch = (bracketData, myTeam) => {
    if (!bracketData) return null;
    const matches = Object.values(bracketData.state);
    if (!myTeam) return null;
    const myMatches = matches
      .filter(m => m.team1 === myTeam || m.team2 === myTeam)
      .sort((a, b) => b.round - a.round);
    if (myMatches.length === 0) return null;
    const nextMatch = myMatches.find(m => !m.winner && m.team1 && m.team2);
    return (nextMatch || myMatches[0]).id;
  };

  // Auto-scroll al abrir bracket
  useEffect(() => {
    if (appMode !== 'bracket' || !activeBracket?.bracketData) return;
    if (hasCenteredRef.current[activeBracketId]) return;
    hasCenteredRef.current[activeBracketId] = true;
    const mainEl = mainRef.current;
    if (!mainEl) return;
    const targetId = findTargetMatch(activeBracket.bracketData, activeBracket.myTeam);
    setTimeout(() => {
      if (targetId) {
        const el = mainEl.querySelector(`[data-match-id="${targetId}"]`);
        if (el) {
          const elRect = el.getBoundingClientRect();
          const mainRect = mainEl.getBoundingClientRect();
          const scrollLeft = mainEl.scrollLeft + elRect.left - mainRect.left - (mainRect.width - elRect.width) / 2;
          const scrollTop = mainEl.scrollTop + elRect.top - mainRect.top - (mainRect.height - elRect.height) / 2;
          mainEl.scrollTo({ left: Math.max(0, scrollLeft), top: Math.max(0, scrollTop), behavior: 'smooth' });
          return;
        }
      }
      mainEl.scrollTo({ left: (mainEl.scrollWidth - mainEl.clientWidth) / 2, top: 0, behavior: 'smooth' });
    }, 150);
  }, [appMode, activeBracketId, !!activeBracket?.bracketData]);

  // Cursores en tiempo real
  useEffect(() => {
    if (appMode !== 'bracket' || !activeBracket?.shareCode || !user || !db) return;
    const shareCode = activeBracket.shareCode;
    const cursorsCol = collection(db, 'artifacts', appId, 'presence', shareCode, 'cursors');
    const unsub = onSnapshot(cursorsCol, (snap) => {
      const now = Date.now();
      const cursors = {};
      snap.docs.forEach(d => {
        if (d.id === user.uid) return;
        const data = d.data();
        if (now - data.ts < 5000) cursors[d.id] = data;
      });
      setRemoteCursors(cursors);
    }, () => {});
    const mainEl = mainRef.current;
    if (!mainEl) return () => unsub();
    const handleMouseMove = (e) => {
      if (cursorThrottleRef.current) return;
      cursorThrottleRef.current = setTimeout(() => { cursorThrottleRef.current = null; }, 400);
      const rect = mainEl.getBoundingClientRect();
      const x = (e.clientX - rect.left + mainEl.scrollLeft) / Math.max(mainEl.scrollWidth, 1);
      const y = (e.clientY - rect.top + mainEl.scrollTop) / Math.max(mainEl.scrollHeight, 1);
      setDoc(doc(db, 'artifacts', appId, 'presence', shareCode, 'cursors', user.uid), {
        x, y,
        name: user.displayName || user.email || 'Usuario',
        color: getUserColor(user.uid),
        ts: Date.now(),
      }).catch(() => {});
    };
    const removeCursor = () => {
      deleteDoc(doc(db, 'artifacts', appId, 'presence', shareCode, 'cursors', user.uid)).catch(() => {});
    };
    mainEl.addEventListener('mousemove', handleMouseMove);
    mainEl.addEventListener('mouseleave', removeCursor);
    return () => {
      mainEl.removeEventListener('mousemove', handleMouseMove);
      mainEl.removeEventListener('mouseleave', removeCursor);
      unsub();
      removeCursor();
      setRemoteCursors({});
      if (cursorThrottleRef.current) { clearTimeout(cursorThrottleRef.current); cursorThrottleRef.current = null; }
    };
  }, [appMode, activeBracket?.shareCode, user?.uid]);

  const handleSetMyTeam = (team) => {
    setBrackets(prev => prev.map(b => b.id === activeBracketId ? { ...b, myTeam: team } : b));
    if (user && db) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', activeBracketId), { myTeam: team || null }, { merge: true }).catch(() => {});
    }
  };

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
      setBrackets(prev => prev.map(b => b.id === bracket.id ? finalBracket : b));
      if (user) {
        setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', bracket.id), toFirestore(finalBracket))
          .catch(e => console.warn('Error guardando shareCode:', e));
      }
    }
    setSharingBracket(finalBracket);
  };

  const handleUpdateShareConfig = async (updates) => {
    if (!sharingBracket?.shareCode) return;
    const newConfig = { ...sharingBracket.shareConfig, ...updates };
    const updated = { ...sharingBracket, shareConfig: newConfig };
    setSharingBracket(updated);
    setBrackets(prev => prev.map(b => b.id === sharingBracket.id ? updated : b));
    await setDoc(doc(db, 'artifacts', appId, 'shared', sharingBracket.shareCode), { shareConfig: newConfig }, { merge: true });
    if (user) setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', sharingBracket.id), { shareConfig: newConfig }, { merge: true }).catch(() => {});
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

  const handleDownloadImage = async () => {
    if (!bracketExportRef.current || isExportingImage) return;
    setIsExportingImage(true);
    try {
      const dataUrl = await toPng(bracketExportRef.current, {
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
        style: { padding: '32px' },
      });
      const a = document.createElement('a');
      a.download = `${activeBracket.name.replace(/[^a-z0-9áéíóúñ ]/gi, '_')}.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error('Error generando imagen:', e);
      alert('No se pudo generar la imagen. Inténtalo de nuevo.');
    }
    setIsExportingImage(false);
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
      if (!data.bracketData || !data.name) { alert('El archivo no es un cuadro válido.'); return; }
      const imported = { ...data, id: Date.now().toString(), createdAt: Date.now(), name: data.name, myTeam: undefined, exportVersion: undefined };
      setBrackets(prev => [imported, ...prev]);
      if (user && db) {
        setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', imported.id), toFirestore(imported))
          .catch(e => console.warn('No se pudo guardar en la nube:', e));
      }
    } catch {
      alert('Error al leer el archivo. Asegúrate de que es un cuadro exportado válido.');
    }
  };

  const handleResultsUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeBracket) return;
    setIsProcessingResults(true);
    try {
      const resultsText = await extractTextFromFile(file);
      const simplifiedBracket = Object.values(activeBracket.bracketData.state).map(m => ({
        id: m.id, title: m.title, team1: m.team1, team2: m.team2, gamesCount: m.gamesCount, format: m.format
      }));
      const aiResults = await callGeminiForResults(simplifiedBracket, resultsText, { onError: setErrorMsg });
      if (aiResults && aiResults.updatedMatches) {
        updateActiveBracketData(prevData => {
          let nextState = JSON.parse(JSON.stringify(prevData.state));
          aiResults.updatedMatches.forEach(aiMatch => {
            if (nextState[aiMatch.id]) {
              nextState[aiMatch.id].scores = aiMatch.scores;
              const oldWinner = nextState[aiMatch.id].winner;
              const newWinner = calculateMatchWinner(nextState[aiMatch.id]);
              nextState[aiMatch.id].winner = newWinner;
              if (oldWinner !== newWinner) {
                if (oldWinner) clearForwardLocal(nextState, aiMatch.id, oldWinner);
                if (newWinner) {
                  const nextId = nextState[aiMatch.id].nextId;
                  if (nextId) {
                    const slot = nextState[aiMatch.id].slot;
                    nextState[nextId][slot] = newWinner;
                  }
                }
              }
            }
          });
          return { ...prevData, state: nextState };
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingResults(false);
      if (fileInputResults.current) fileInputResults.current.value = '';
    }
  };

  // --- RENDER ---
  if (appMode === 'loading') return <LoadingScreen />;

  if (appMode === 'dashboard') return (
    <DashboardScreen
      user={user}
      brackets={brackets}
      firebaseError={firebaseError}
      dashboardSearch={dashboardSearch}
      setDashboardSearch={setDashboardSearch}
      dashboardSort={dashboardSort}
      setDashboardSort={setDashboardSort}
      setActiveBracketId={setActiveBracketId}
      setAppMode={setAppMode}
      setZoom={setZoom}
      handleShare={handleShare}
      handleExport={handleExport}
      handleDeleteBracket={handleDeleteBracket}
      bracketToDelete={bracketToDelete}
      setBracketToDelete={setBracketToDelete}
      confirmDelete={confirmDelete}
      handleLogout={handleLogout}
      fileInputImport={fileInputImport}
      handleImport={handleImport}
      sharingBracket={sharingBracket}
      setSharingBracket={setSharingBracket}
      inviteEmail={inviteEmail}
      setInviteEmail={setInviteEmail}
      invitePermission={invitePermission}
      setInvitePermission={setInvitePermission}
      copiedCode={copiedCode}
      setCopiedCode={setCopiedCode}
      handleAddInvite={handleAddInvite}
      handleUpdateShareConfig={handleUpdateShareConfig}
      handleRemoveInvite={handleRemoveInvite}
      shareUrlBase={shareUrlBase}
    />
  );

  if (appMode === 'upload') return (
    <UploadScreen
      newBracketName={newBracketName}
      setNewBracketName={setNewBracketName}
      basesFile={basesFile}
      setBasesFile={setBasesFile}
      clasifFile={clasifFile}
      setClasifFile={setClasifFile}
      customPrompt={customPrompt}
      setCustomPrompt={setCustomPrompt}
      isProcessing={isProcessing}
      processStatus={processStatus}
      errorMsg={errorMsg}
      setErrorMsg={setErrorMsg}
      fileInputBases={fileInputBases}
      fileInputClasif={fileInputClasif}
      handleProcessDocuments={handleProcessDocuments}
      setAppMode={setAppMode}
    />
  );

  if (appMode === 'preview' && pendingBracket) return (
    <PreviewScreen
      pendingBracket={pendingBracket}
      setPendingBracket={setPendingBracket}
      previewZoom={previewZoom}
      setPreviewZoom={setPreviewZoom}
      handleConfirmBracket={handleConfirmBracket}
      setAppMode={setAppMode}
    />
  );

  if (!activeBracket) return <LoadingScreen />;

  return (
    <BracketScreen
      activeBracket={activeBracket}
      activeBracketId={activeBracketId}
      canEdit={canEdit}
      zoom={zoom}
      setZoom={setZoom}
      showResetModal={showResetModal}
      setShowResetModal={setShowResetModal}
      confirmReset={confirmReset}
      saveError={saveError}
      showMobileTools={showMobileTools}
      setShowMobileTools={setShowMobileTools}
      sharingBracket={sharingBracket}
      setSharingBracket={setSharingBracket}
      inviteEmail={inviteEmail}
      setInviteEmail={setInviteEmail}
      invitePermission={invitePermission}
      setInvitePermission={setInvitePermission}
      copiedCode={copiedCode}
      setCopiedCode={setCopiedCode}
      editingBracketName={editingBracketName}
      setEditingBracketName={setEditingBracketName}
      bracketNameInput={bracketNameInput}
      setBracketNameInput={setBracketNameInput}
      setBrackets={setBrackets}
      user={user}
      db={db}
      appId={appId}
      isProcessingResults={isProcessingResults}
      isExportingImage={isExportingImage}
      canUndo={canUndo}
      canRedo={canRedo}
      handleUndo={handleUndo}
      handleRedo={handleRedo}
      handleShare={handleShare}
      handleDownloadImage={handleDownloadImage}
      handleSetMyTeam={handleSetMyTeam}
      handleAddInvite={handleAddInvite}
      handleUpdateShareConfig={handleUpdateShareConfig}
      handleRemoveInvite={handleRemoveInvite}
      handleScoreChange={handleScoreChange}
      handleSorteoSelect={handleSorteoSelect}
      handleResultsUpload={handleResultsUpload}
      fileInputResults={fileInputResults}
      mainRef={mainRef}
      bracketExportRef={bracketExportRef}
      remoteCursors={remoteCursors}
      setAppMode={setAppMode}
      shareUrlBase={shareUrlBase}
    />
  );
}
