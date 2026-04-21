import { useState, useRef, useEffect } from 'react';
import { getDoc, setDoc } from 'firebase/firestore';
import { userDocRef } from '../services/firestoreHelpers';
import logger from '../utils/logger';
import { buildDynamicBracket } from '../utils/bracketEngine';
import { extractTextFromFile } from '../services/aiService';
import { toFirestore } from '../services/firestoreService';
import { useCopilot } from '../contexts/CopilotProvider';
import { teamDisplayName } from '../utils/teamUtils';

export function useBracketCreation({
  user,
  db,
  appId,
  initialTeamId,
  setBrackets,
  setActiveBracketId,
  setAppMode,
  pendingBracket,
  setPendingBracket,
  setPreviewZoom,
}) {
  const { runAgent } = useCopilot();
  const [newBracketName, setNewBracketName] = useState('');
  const [basesFile, setBasesFile] = useState(null);
  const [clasifFile, setClasifFile] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [pendingTeamId, setPendingTeamId] = useState(null);
  const [pendingTeamObj, setPendingTeamObj] = useState(null);
  const [lastTraceId, setLastTraceId] = useState(null);

  const [manualTeamCount, setManualTeamCount] = useState(8);
  const [manualFormat, setManualFormat] = useState('Partido único');

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
          setNewBracketName(`Torneo ${teamDisplayName(snap.data())}`);
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
      const { result: aiData, traceId } = await runAgent('bracket', {
        basesText,
        clasifText,
        userInstructions: customPrompt,
      });
      setLastTraceId(traceId);

      if (!aiData || !Array.isArray(aiData.initialMatches) || aiData.initialMatches.length === 0) {
        throw new Error(
          'La IA no devolvió un cuadro válido. Inténtalo de nuevo o ajusta las instrucciones adicionales.',
        );
      }

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
      const code = err?.code || '';
      const msg = err?.message || '';
      if (code === 'deadline-exceeded' || msg.includes('deadline-exceeded')) {
        setErrorMsg(
          'La IA tardó demasiado en responder. Los servidores pueden estar saturados. Inténtalo de nuevo en unos segundos.',
        );
      } else {
        setErrorMsg(msg || 'Ocurrió un error inesperado al procesar los documentos.');
      }
      setIsProcessing(false);
    }
  };

  const handleCreateManualBracket = () => {
    if (!newBracketName.trim()) {
      setErrorMsg("Por favor, dale un nombre a este cuadro (ej. 'Fase Final').");
      return;
    }

    setErrorMsg('');
    const count = parseInt(manualTeamCount) || 8;
    const initialMatches = [];
    for (let i = 0; i < count / 2; i++) {
      initialMatches.push({
        title: `Partido ${i + 1}`,
        team1: null,
        team2: null,
        team1Options: [],
        team2Options: [],
      });
    }

    const gamesCount = manualFormat === 'Ida y Vuelta' ? 2 : manualFormat === 'Al mejor de 3' ? 3 : 1;

    try {
      const numRounds = Math.log2(count);
      const rounds = Array.from({ length: numRounds }).map(() => ({
        format: manualFormat,
        gamesCount,
      }));

      const bracketDynamicTree = buildDynamicBracket(initialMatches, rounds);

      const newBracketObj = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        name: newBracketName.trim(),
        tournamentNameDetected: 'Cuadro Manual',
        initialMatchesArray: initialMatches,
        roundsData: rounds,
        allTeams: [],
        bracketData: bracketDynamicTree,
      };

      setPendingBracket(newBracketObj);
      setPreviewZoom(0.7);
      setAppMode('preview');
    } catch (err) {
      logger.error('Error procesando cuadro manual', err);
      setErrorMsg('Error al generar cuadro: ' + err.message);
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
            // myTeam comes from pendingBracket (set in preview via team selector)
            myTeam: pendingBracket.myTeam || null,
          }
        : pendingBracket;

    // Commit local state + navigation first, so a Firestore error can't block the transition.
    setBrackets((prev) => [bracketToSave, ...prev]);
    setActiveBracketId(bracketToSave.id);
    setPendingBracket(null);
    setNewBracketName('');
    setBasesFile(null);
    setClasifFile(null);
    setCustomPrompt('');
    setAppMode('bracket');

    localStorage.setItem('playoffs:lastActiveBracketId', bracketToSave.id);
    if (user && db) {
      try {
        setDoc(userDocRef(db, appId, user.uid, 'brackets', bracketToSave.id), toFirestore(bracketToSave)).catch((e) =>
          logger.warn('No se pudo guardar en la nube', e),
        );
      } catch (e) {
        logger.warn('No se pudo guardar en la nube', e);
      }
    }
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
    pendingTeamObj,
    handleProcessDocuments,
    handleCreateManualBracket,
    handleConfirmBracket,
    fileInputBases,
    fileInputClasif,
    lastTraceId,
    manualTeamCount,
    setManualTeamCount,
    manualFormat,
    setManualFormat,
  };
}
