import { useState, useRef, useEffect } from 'react';
import { getDoc, setDoc } from 'firebase/firestore';
import { userDocRef } from '../services/firestoreHelpers';
import logger from '../utils/logger';
import { buildDynamicBracket } from '../utils/bracketEngine';
import { extractTextFromFile, callGeminiForBracket } from '../services/aiService';
import { toFirestore } from '../services/firestoreService';
import { teamDisplayName } from '../screens/TeamsScreen';

export function useBracketCreation({ user, db, appId, initialTeamId, setBrackets, setActiveBracketId, setAppMode }) {
  const [newBracketName, setNewBracketName] = useState('');
  const [basesFile, setBasesFile] = useState(null);
  const [clasifFile, setClasifFile] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [pendingBracket, setPendingBracket] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(0.7);
  const [pendingTeamId, setPendingTeamId] = useState(null);
  const [pendingTeamObj, setPendingTeamObj] = useState(null);

  const fileInputBases = useRef(null);
  const fileInputClasif = useRef(null);

  // Fetch equipo asociado por initialTeamId
  useEffect(() => {
    if (!initialTeamId || !db || !user) return;
    getDoc(userDocRef(db, appId, user.uid, 'teams', initialTeamId))
      .then((snap) => {
        if (snap.exists()) {
          setPendingTeamId(initialTeamId);
          setPendingTeamObj(snap.data());
          setNewBracketName(`Playoff ${teamDisplayName(snap.data())}`);
        }
      })
      .catch((e) => logger.warn('Error cargando equipo inicial', e));
  }, [initialTeamId, db, user]);

  const handleProcessDocuments = async () => {
    if (!basesFile || !clasifFile) {
      setErrorMsg('Debes subir AMBOS documentos para que la IA los procese.');
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
      if (!basesText || !clasifText) throw new Error('No se pudo extraer texto.');

      if (basesText.length > 45000 || clasifText.length > 45000) {
        setProcessStatus(
          '⚠️ El documento es muy extenso; solo se analizarán los primeros 45 KB. Si el resultado es incorrecto, usa el campo de contexto adicional.',
        );
        await new Promise((r) => setTimeout(r, 3000));
      }

      setProcessStatus('La IA está analizando minuciosamente los cruces y grupos...');
      const aiData = await callGeminiForBracket(basesText, clasifText, customPrompt, {
        onStatus: setProcessStatus,
        onError: setErrorMsg,
      });

      if (!aiData || !aiData.initialMatches) throw new Error('No se recibió información válida de la IA.');

      setProcessStatus('Generando Bracket Dinámico...');
      const bracketDynamicTree = buildDynamicBracket(aiData.initialMatches, aiData.rounds);

      const allTeamsSet = new Set();
      aiData.initialMatches.forEach((m) => {
        if (m.team1) allTeamsSet.add(m.team1);
        if (m.team2) allTeamsSet.add(m.team2);
        if (m.team1Options) m.team1Options.forEach((t) => allTeamsSet.add(t));
        if (m.team2Options) m.team2Options.forEach((t) => allTeamsSet.add(t));
      });

      const newBracketObj = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        name: newBracketName.trim(),
        tournamentNameDetected: aiData.tournamentName,
        initialMatchesArray: aiData.initialMatches,
        roundsData: aiData.rounds || [],
        allTeams: Array.from(allTeamsSet).sort(),
        bracketData: bracketDynamicTree,
      };

      setPendingBracket(newBracketObj);
      setPreviewZoom(0.7);
      setIsProcessing(false);
      setAppMode('preview');
    } catch (err) {
      logger.error('Error procesando documentos', err);
      if (err.message !== 'RATE_LIMIT' && err.message !== 'FORBIDDEN') {
        setErrorMsg(err.message || 'Ocurrió un error inesperado al procesar los documentos.');
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
    const bracketToSave =
      pendingTeamId && pendingTeamObj
        ? {
            ...pendingBracket,
            teamId: pendingTeamId,
            teamName: teamDisplayName(pendingTeamObj),
            myTeam: teamDisplayName(pendingTeamObj),
          }
        : pendingBracket;
    setBrackets((prev) => [bracketToSave, ...prev]);
    setActiveBracketId(bracketToSave.id);
    localStorage.setItem('playoffs:lastActiveBracketId', bracketToSave.id);
    if (user && db) {
      setDoc(userDocRef(db, appId, user.uid, 'brackets', bracketToSave.id), toFirestore(bracketToSave)).catch((e) =>
        logger.warn('No se pudo guardar en la nube', e),
      );
    }
    setPendingBracket(null);
    setNewBracketName('');
    setBasesFile(null);
    setClasifFile(null);
    setCustomPrompt('');
    setAppMode('bracket');
  };

  return {
    newBracketName,
    setNewBracketName,
    basesFile,
    setBasesFile,
    clasifFile,
    setClasifFile,
    customPrompt,
    setCustomPrompt,
    errorMsg,
    setErrorMsg,
    isProcessing,
    processStatus,
    pendingBracket,
    setPendingBracket,
    previewZoom,
    setPreviewZoom,
    pendingTeamObj,
    handleProcessDocuments,
    handleConfirmBracket,
    fileInputBases,
    fileInputClasif,
  };
}
