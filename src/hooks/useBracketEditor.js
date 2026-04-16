import { useState, useRef, useEffect, useCallback } from 'react';
import { setDoc } from 'firebase/firestore';
import { userDocRef } from '../services/firestoreHelpers';
import logger from '../utils/logger';
import { buildDynamicBracket, calculateMatchWinner } from '../utils/bracketEngine';
import { extractTextFromFile } from '../services/aiService';
import { saveBracketToFirestore } from '../services/firestoreService';
import { useCopilot } from '../contexts/CopilotProvider';
import { useToast } from '../contexts/ToastContext';

export function useBracketEditor({
  user,
  db,
  appId,
  brackets,
  setBrackets,
  activeBracketId,
  activeBracket,
  canEdit,
  appMode,
}) {
  const toast = useToast();
  const { runAgent } = useCopilot();
  const [zoom, setZoom] = useState(1);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showMobileTools, setShowMobileTools] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isProcessingResults, setIsProcessingResults] = useState(false);
  const [editingBracketName, setEditingBracketName] = useState(false);
  const [bracketNameInput, setBracketNameInput] = useState('');
  const [saveError, setSaveError] = useState('');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const historyRef = useRef({});
  const hasCenteredRef = useRef({});
  const mainRef = useRef(null);
  const bracketExportRef = useRef(null);
  const fileInputResults = useRef(null);

  // Stable refs for useCallback dependencies
  const bracketsRef = useRef(brackets);
  bracketsRef.current = brackets;
  const activeBracketIdRef = useRef(activeBracketId);
  activeBracketIdRef.current = activeBracketId;

  // Resetear undo/redo al cambiar de cuadro
  useEffect(() => {
    if (activeBracketId) delete hasCenteredRef.current[activeBracketId];
    const h = historyRef.current[activeBracketId];
    setCanUndo(!!h?.undo?.length);
    setCanRedo(!!h?.redo?.length);
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

  // --- Internal helpers ---

  const findTargetMatch = (bracketData, myTeam) => {
    if (!bracketData) return null;
    const matches = Object.values(bracketData.state);
    if (!myTeam) return null;
    const myMatches = matches.filter((m) => m.team1 === myTeam || m.team2 === myTeam).sort((a, b) => b.round - a.round);
    if (myMatches.length === 0) return null;
    const nextMatch = myMatches.find((m) => !m.winner && m.team1 && m.team2);
    return (nextMatch || myMatches[0]).id;
  };

  const fireSave = (bracket, updatedBracket) =>
    saveBracketToFirestore(bracket, updatedBracket, {
      user,
      db,
      appId,
      onError: (msg) => {
        setSaveError(msg);
        setTimeout(() => setSaveError(''), 4000);
      },
    });

  const updateActiveBracketData = useCallback(
    async (updaterFn, skipHistory = false) => {
      const id = activeBracketIdRef.current;
      const bracket = bracketsRef.current.find((b) => b.id === id);
      if (!bracket) return;
      if (!skipHistory) {
        const h = historyRef.current[id] || { undo: [], redo: [] };
        const newUndo = [...h.undo, bracket.bracketData].slice(-10);
        historyRef.current[id] = { undo: newUndo, redo: [] };
        setCanUndo(true);
        setCanRedo(false);
      }
      const newBracketData = updaterFn(bracket.bracketData);
      const updatedBracket = { ...bracket, bracketData: newBracketData };
      setBrackets((prevBrackets) => prevBrackets.map((b) => (b.id === id ? updatedBracket : b)));
      await fireSave(bracket, updatedBracket);
    },
    [setBrackets],
  );

  const clearForwardLocal = (stateDict, matchId, teamToClear) => {
    let currId = stateDict[matchId].nextId;
    let prevId = matchId;
    while (currId) {
      const slot = stateDict[prevId].slot;
      if (stateDict[currId][slot] === teamToClear) {
        stateDict[currId] = { ...stateDict[currId], [slot]: null };
        stateDict[currId].scores = stateDict[currId].scores.map((s) => ({
          ...s,
          [slot === 'team1' ? 's1' : 's2']: '',
        }));
      }
      if (stateDict[currId].winner === teamToClear) {
        stateDict[currId] = { ...stateDict[currId], winner: null };
        prevId = currId;
        currId = stateDict[currId].nextId;
      } else break;
    }
  };

  // --- Handlers ---

  const handleUndo = async () => {
    const bracket = brackets.find((b) => b.id === activeBracketId);
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
    setBrackets((prev) => prev.map((b) => (b.id === activeBracketId ? updatedBracket : b)));
    await fireSave(bracket, updatedBracket);
  };

  const handleRedo = async () => {
    const bracket = brackets.find((b) => b.id === activeBracketId);
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
    setBrackets((prev) => prev.map((b) => (b.id === activeBracketId ? updatedBracket : b)));
    await fireSave(bracket, updatedBracket);
  };

  const handleSorteoSelect = useCallback(
    (matchId, teamIndex, selectedTeam) => {
      updateActiveBracketData((prevData) => {
        const nextState = { ...prevData.state };
        const match = { ...nextState[matchId] };
        const oldTeam = teamIndex === 1 ? match.team1 : match.team2;
        if (teamIndex === 1) match.team1 = selectedTeam || null;
        else match.team2 = selectedTeam || null;
        if (oldTeam !== selectedTeam) {
          match.scores = match.scores.map((s) => ({ ...s, [teamIndex === 1 ? 's1' : 's2']: '' }));
          if (match.winner === oldTeam || (match.winner && match.winner !== selectedTeam)) {
            clearForwardLocal(nextState, matchId, match.winner);
            match.winner = null;
          }
        }
        nextState[matchId] = match;
        return { ...prevData, state: nextState };
      });
    },
    [updateActiveBracketData],
  );

  const handleEditTeamName = useCallback(
    (matchId, teamIndex, newName) => {
      updateActiveBracketData((prevData) => {
        const nextState = { ...prevData.state };
        const match = { ...nextState[matchId] };
        const oldTeam = teamIndex === 1 ? match.team1 : match.team2;

        if (teamIndex === 1) match.team1 = newName || null;
        else match.team2 = newName || null;

        if (oldTeam !== newName) {
          if (match.winner === oldTeam || (match.winner && match.winner !== newName)) {
            clearForwardLocal(nextState, matchId, match.winner);
            match.winner = null;
            // Also reset score to avoid weird auto-wins if name changes?
            // In manual it's simpler to let score be, or reset if changed.
            // But usually we just let the score recalculate properly on next score change, or reset it.
            // The AI implementation resetted scores when picking from Sorteo. We can do that too:
            // match.scores = match.scores.map((s) => ({ ...s, [teamIndex === 1 ? 's1' : 's2']: '' }));
          }
        }

        nextState[matchId] = match;
        return { ...prevData, state: nextState };
      });
    },
    [updateActiveBracketData],
  );

  const handleEditMatchSettings = useCallback(
    (matchId, newTitle, newGamesCount) => {
      updateActiveBracketData((prevData) => {
        const nextState = { ...prevData.state };
        const match = { ...nextState[matchId] };

        match.title = newTitle;

        if (newGamesCount !== match.gamesCount) {
          match.gamesCount = newGamesCount;
          match.format = newGamesCount === 1 ? 'Partido único' : newGamesCount === 2 ? 'Ida y Vuelta' : 'Al mejor de 3';

          const newScores = [...match.scores];
          while (newScores.length < newGamesCount) {
            newScores.push({ s1: '', s2: '' });
          }
          if (newScores.length > newGamesCount) {
            newScores.length = newGamesCount; // Truncate
          }
          match.scores = newScores;

          const newWinner = calculateMatchWinner(match);
          const oldWinner = match.winner;
          match.winner = newWinner;

          if (oldWinner !== newWinner) {
            if (oldWinner) clearForwardLocal(nextState, matchId, oldWinner);
            if (newWinner && match.nextId) {
              nextState[match.nextId] = { ...nextState[match.nextId], [match.slot]: newWinner };
            }
          }
        }

        nextState[matchId] = match;
        return { ...prevData, state: nextState };
      });
    },
    [updateActiveBracketData],
  );

  const handleScoreChange = useCallback(
    (matchId, teamIndex, gameIndex, value) => {
      updateActiveBracketData((prevData) => {
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
    },
    [updateActiveBracketData],
  );

  const confirmReset = () => {
    updateActiveBracketData(() => buildDynamicBracket(activeBracket.initialMatchesArray, activeBracket.roundsData));
    setShowResetModal(false);
  };

  const handleSetMyTeam = (team) => {
    setBrackets((prev) => prev.map((b) => (b.id === activeBracketId ? { ...b, myTeam: team } : b)));
    if (user && db) {
      setDoc(
        userDocRef(db, appId, user.uid, 'brackets', activeBracketId),
        { myTeam: team || null },
        { merge: true },
      ).catch((e) => logger.warn('Error guardando myTeam', e));
    }
  };

  const handleDownloadImage = async () => {
    if (!bracketExportRef.current || isExportingImage) return;
    setIsExportingImage(true);
    try {
      const { toPng } = await import('html-to-image');
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
      logger.error('Error generando imagen', e);
      toast('No se pudo generar la imagen. Inténtalo de nuevo.', 'error');
    }
    setIsExportingImage(false);
  };

  const handleResultsUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeBracket) return;
    setIsProcessingResults(true);
    try {
      const resultsText = await extractTextFromFile(file);
      const simplifiedBracket = Object.values(activeBracket.bracketData.state).map((m) => ({
        id: m.id,
        title: m.title,
        team1: m.team1,
        team2: m.team2,
        gamesCount: m.gamesCount,
        format: m.format,
      }));
      const { result: aiResults } = await runAgent('results', {
        bracketState: simplifiedBracket,
        resultsText,
      });
      if (aiResults && aiResults.updatedMatches) {
        updateActiveBracketData((prevData) => {
          let nextState = JSON.parse(JSON.stringify(prevData.state));
          aiResults.updatedMatches.forEach((aiMatch) => {
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
      logger.error('Error procesando resultados', err);
    } finally {
      setIsProcessingResults(false);
      if (fileInputResults.current) fileInputResults.current.value = '';
    }
  };

  return {
    zoom,
    setZoom,
    showResetModal,
    setShowResetModal,
    showMobileTools,
    setShowMobileTools,
    isExportingImage,
    isProcessingResults,
    editingBracketName,
    setEditingBracketName,
    bracketNameInput,
    setBracketNameInput,
    saveError,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleScoreChange,
    handleSorteoSelect,
    handleEditTeamName,
    handleEditMatchSettings,
    confirmReset,
    handleSetMyTeam,
    handleDownloadImage,
    handleResultsUpload,
    mainRef,
    bracketExportRef,
    fileInputResults,
    updateActiveBracketData,
  };
}
