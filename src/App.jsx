import React, { useState, useRef, useEffect } from 'react';
import { Trophy, ZoomIn, ZoomOut, RefreshCw, Star, UploadCloud, FileText, CheckCircle, ArrowRight, Loader2, Plus, Trash2, FolderOpen, ChevronLeft, MessageSquare, Calendar, FileDigit, X, Cloud, CloudOff, LogOut, LogIn, User } from 'lucide-react';

// --- INTEGRACIÓN CON FIREBASE / FIRESTORE ---
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// ⚠️ CONFIGURACIÓN DE FIREBASE (SOLO PARA BASE DE DATOS Y AUTH)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app, auth, db, appId;
try {
  const configToUse = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : firebaseConfig;

  if (configToUse.apiKey) {
    app = initializeApp(configToUse);
    auth = getAuth(app);
    db = getFirestore(app);
    appId = typeof __app_id !== 'undefined' ? __app_id : 'uros-fbm-app';
  }
} catch (error) {
  console.error("Error inicializando Firebase:", error);
}

// --- GENERADOR DEL ÁRBOL DINÁMICO Y GENÉRICO ---
const buildDynamicBracket = (initialMatches, roundsData = []) => {
  let state = {};
  
  let currentRound = initialMatches.map((m, i) => {
    let matchId = `R1-M${i}`;
    const rData = roundsData[0] || { dates: [], format: 'Partido único', gamesCount: 1 };
    
    state[matchId] = {
      id: matchId,
      title: m.title || `Partido ${i + 1}`,
      team1: m.team1,
      team2: m.team2,
      team1Origin: m.team1Origin,
      team2Origin: m.team2Origin,
      team1Options: m.team1Options || [],
      team2Options: m.team2Options || [],
      dates: rData.dates || [],
      format: rData.format || 'Partido único',
      gamesCount: rData.gamesCount || 1,
      scores: Array.from({ length: rData.gamesCount || 1 }, () => ({ s1: '', s2: '' })),
      winner: null,
      round: 1,
      nextId: null,
      slot: null,
      children: null,
    };
    return matchId;
  });

  let roundNum = 2;
  let previousRound = currentRound;

  while (previousRound.length > 1) {
    let nextRound = [];
    for (let i = 0; i < previousRound.length; i += 2) {
      let matchId = `R${roundNum}-M${i / 2}`;
      let child1 = previousRound[i];
      let child2 = previousRound[i + 1];
      
      const rData = roundsData[roundNum - 1] || { dates: [], format: 'Partido único', gamesCount: 1 };

      state[matchId] = {
        id: matchId,
        title: rData.name || (previousRound.length === 2 ? "FINAL" : (previousRound.length === 4 ? "SEMIFINALES" : (previousRound.length === 8 ? "CUARTOS DE FINAL" : `Ronda ${roundNum}`))),
        team1: null,
        team2: null,
        team1Origin: null,
        team2Origin: null,
        team1Options: [],
        team2Options: [],
        dates: rData.dates || [],
        format: rData.format || 'Partido único',
        gamesCount: rData.gamesCount || 1,
        scores: Array.from({ length: rData.gamesCount || 1 }, () => ({ s1: '', s2: '' })),
        winner: null,
        round: roundNum,
        children: [child1, child2],
        nextId: null,
        slot: null,
      };

      state[child1].nextId = matchId;
      state[child1].slot = 'team1';
      state[child2].nextId = matchId;
      state[child2].slot = 'team2';

      nextRound.push(matchId);
    }
    previousRound = nextRound;
    roundNum++;
  }

  return { state, rootId: previousRound[0] };
};

// --- MOTOR DE CÁLCULO DE GANADORES ---
const calculateMatchWinner = (match) => {
  let wins1 = 0, wins2 = 0, total1 = 0, total2 = 0, playedGames = 0;

  match.scores.forEach(g => {
     const s1 = parseInt(g.s1);
     const s2 = parseInt(g.s2);
     if (!isNaN(s1) && !isNaN(s2)) {
        playedGames++;
        total1 += s1; 
        total2 += s2;
        if (s1 > s2) wins1++;
        else if (s2 > s1) wins2++;
     }
  });

  if (match.gamesCount === 3) {
     if (wins1 >= 2) return match.team1;
     else if (wins2 >= 2) return match.team2;
  } else if (match.gamesCount === 2) {
     if (playedGames === 2) {
        if (total1 > total2) return match.team1;
        else if (total2 > total1) return match.team2;
     }
  } else {
     if (playedGames >= 1) {
        if (wins1 > wins2) return match.team1;
        else if (wins2 > wins1) return match.team2;
     }
  }
  return null;
};

// --- COMPONENTES UI DEL BRACKET ---
const MatchCard = ({ match, bracketData, onScoreChange, onSelectSorteo, isFinal, myTeam }) => {
  const isReady = match.team1 && match.team2;

  const getUsedOptions = () => {
    return Object.values(bracketData.state)
      .filter(m => m.round === 1 && m.id !== match.id)
      .flatMap(m => [m.team1, m.team2])
      .filter(Boolean);
  };

  const getRowStyle = (teamName, isWinner, isLoser) => {
    let style = "flex items-center justify-between px-2 py-2 transition-colors border-b border-slate-100 ";
    if (!teamName && match.team1Options.length === 0 && match.team2Options.length === 0) {
        return style + "bg-slate-50 text-slate-400";
    }
    if (teamName && teamName === myTeam) {
      if (isWinner) style += "bg-fuchsia-200 text-fuchsia-900 font-bold border-l-4 border-l-fuchsia-600 ";
      else if (isLoser) style += "bg-fuchsia-50 text-fuchsia-400/80 opacity-80 border-l-4 border-l-fuchsia-300 ";
      else style += "bg-fuchsia-100 text-fuchsia-900 font-semibold border-l-4 border-l-fuchsia-500 ";
    } else {
      if (isWinner) style += "bg-green-100 text-green-800 font-bold border-l-4 border-l-green-500 ";
      else if (isLoser) style += "bg-red-50 text-red-400/80 opacity-70 ";
      else style += "hover:bg-blue-50 text-slate-800 ";
    }
    return style;
  };

  const isGameDisabled = (gIdx) => {
    if (!isReady) return true;
    if (match.gamesCount === 3 && gIdx === 2) {
      const s1_1 = parseInt(match.scores[0].s1), s1_2 = parseInt(match.scores[0].s2);
      const s2_1 = parseInt(match.scores[1].s1), s2_2 = parseInt(match.scores[1].s2);
      
      if (!isNaN(s1_1) && !isNaN(s1_2) && !isNaN(s2_1) && !isNaN(s2_2)) {
         const t1Wins = (s1_1 > s1_2 ? 1 : 0) + (s2_1 > s2_2 ? 1 : 0);
         const t2Wins = (s1_2 > s1_1 ? 1 : 0) + (s2_2 > s2_1 ? 1 : 0);
         if (t1Wins === 2 || t2Wins === 2) return true;
      }
    }
    return false;
  };

  const renderTeamRow = (team, origin, options, scores, teamIndex) => {
    const isWinner = match.winner === team && match.winner;
    const isLoser = match.winner && team && match.winner !== team;
    const isDropdown = options && options.length > 0;

    return (
      <div className={getRowStyle(team, isWinner, isLoser) + (teamIndex === 2 ? " border-b-0" : "")}>
        <div className="flex flex-col flex-1 overflow-hidden pr-3 justify-center">
          {isDropdown ? (
            <select 
              value={team || ""} 
              onChange={(e) => onSelectSorteo(match.id, teamIndex, e.target.value)}
              className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 font-normal bg-white"
            >
              <option key="default-opt" value="">-- Asignar Equipo --</option>
              {options.map((opt, idx) => (
                <option key={`opt-${match.id}-${teamIndex}-${idx}`} value={opt} disabled={getUsedOptions().includes(opt)}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-sm font-medium" title={team}>{team || 'Por determinar'}</span>
          )}
          
          {origin && (
            <span className="text-[10px] text-slate-500 truncate mt-0.5 leading-tight font-normal" title={origin}>
              {origin}
            </span>
          )}
        </div>
        
        <div className="flex gap-1 shrink-0">
          {scores.map((scoreObj, gIdx) => {
             const disabledGame = isGameDisabled(gIdx);
             const inputBaseClass = "w-[72px] h-8 text-center text-sm font-semibold border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
             const disabledClass = disabledGame ? "bg-slate-200 text-transparent opacity-50 cursor-not-allowed border-transparent" : "disabled:bg-slate-100 disabled:text-transparent";
             
             return (
               <input 
                 key={`score-${match.id}-${teamIndex}-${gIdx}`}
                 type="number" 
                 value={teamIndex === 1 ? scoreObj.s1 : scoreObj.s2} 
                 onChange={(e) => onScoreChange(match.id, teamIndex, gIdx, e.target.value)} 
                 disabled={disabledGame} 
                 placeholder={!disabledGame && match.gamesCount > 1 ? `J${gIdx + 1}` : "-"}
                 className={`${inputBaseClass} ${disabledClass}`}
               />
             )
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative flex flex-col min-w-[380px] sm:w-[460px] bg-white border ${isFinal ? 'border-amber-400 shadow-amber-200 shadow-lg' : 'border-slate-300 shadow-md'} rounded-lg overflow-hidden transition-all hover:shadow-lg`}>
      <div className={`relative text-[11px] uppercase tracking-wider font-bold text-center py-1.5 ${isFinal ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-700'} flex items-center justify-center gap-1`}>
        {isFinal && <Trophy size={14} />}
        {match.title}
        {isFinal && <Trophy size={14} />}
      </div>
      
      <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 px-2 py-1.5">
        <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
           <Calendar size={10} /> {match.format}
        </div>
        <div className="flex gap-1 justify-end pr-0.5">
          {match.scores.map((_, i) => (
            <div key={`date-${i}`} className={`w-[72px] text-center text-[10px] font-bold tracking-tight ${isGameDisabled(i) ? 'text-slate-300 opacity-50' : 'text-slate-500'}`} title={match.dates?.[i]}>
              {match.dates?.[i] || `J${i + 1}`}
            </div>
          ))}
        </div>
      </div>

      {renderTeamRow(match.team1, match.team1Origin, match.team1Options, match.scores, 1)}
      {renderTeamRow(match.team2, match.team2Origin, match.team2Options, match.scores, 2)}
    </div>
  );
};

const BracketNode = ({ nodeId, bracketData, onScoreChange, onSelectSorteo, myTeam }) => {
  if (!bracketData || !bracketData.state[nodeId]) return null;
  const node = bracketData.state[nodeId];
  const isLeaf = !node.children;
  const isRoot = node.nextId === null;

  const hasTeam = (id) => {
    if (!id || !myTeam) return false;
    const n = bracketData.state[id];
    return n && (n.team1 === myTeam || n.team2 === myTeam);
  };

  const nodeHasTeam = hasTeam(node.id);
  const child0HasTeam = !isLeaf && hasTeam(node.children[0]);
  const child1HasTeam = !isLeaf && hasTeam(node.children[1]);

  return (
    <div className="flex flex-col items-center">
      <MatchCard 
        match={node} 
        bracketData={bracketData}
        onScoreChange={onScoreChange} 
        onSelectSorteo={onSelectSorteo} 
        isFinal={isRoot} 
        myTeam={myTeam} 
      />
      {!isLeaf && (
        <>
          <div className={`w-[2px] h-6 transition-colors duration-300 ${nodeHasTeam ? 'bg-fuchsia-500' : 'bg-slate-300'}`}></div>
          
          <div className="flex items-start">
            <div className="flex flex-col items-center relative w-full">
              <div className={`absolute top-0 right-0 w-1/2 h-[2px] transition-colors duration-300 ${child0HasTeam ? 'bg-fuchsia-500 z-10' : 'bg-slate-300'}`}></div>
              <div className={`w-[2px] h-6 transition-colors duration-300 ${child0HasTeam ? 'bg-fuchsia-500 z-10' : 'bg-slate-300'}`}></div>
              <div className="px-2 sm:px-4">
                <BracketNode nodeId={node.children[0]} bracketData={bracketData} onScoreChange={onScoreChange} onSelectSorteo={onSelectSorteo} myTeam={myTeam} />
              </div>
            </div>
            
            <div className="flex flex-col items-center relative w-full">
              <div className={`absolute top-0 left-0 w-1/2 h-[2px] transition-colors duration-300 ${child1HasTeam ? 'bg-fuchsia-500 z-10' : 'bg-slate-300'}`}></div>
              <div className={`w-[2px] h-6 transition-colors duration-300 ${child1HasTeam ? 'bg-fuchsia-500 z-10' : 'bg-slate-300'}`}></div>
              <div className="px-2 sm:px-4">
                <BracketNode nodeId={node.children[1]} bracketData={bracketData} onScoreChange={onScoreChange} onSelectSorteo={onSelectSorteo} myTeam={myTeam} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// --- COMPONENTE DE BÚSQUEDA DE EQUIPO ---
const TeamSearchableSelect = ({ teams, selectedTeam, onSelectTeam }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => {
    setSearchTerm(selectedTeam || '');
    setIsOpen(true);
  };

  const filteredTeams = teams.filter(team =>
    team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative w-full sm:w-64">
      <div className="flex items-center gap-2 bg-blue-800/50 p-2 rounded-lg border border-blue-700 cursor-text" onClick={() => setIsOpen(true)}>
        <Star size={18} className="text-fuchsia-300 shrink-0" />
        <input
          type="text"
          value={isOpen ? searchTerm : (selectedTeam || '')}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={handleFocus}
          placeholder="Buscar o destacar equipo..."
          className="bg-transparent text-sm text-white font-medium focus:outline-none w-full placeholder-blue-300"
        />
        {selectedTeam && (
           <button
             onClick={(e) => {
               e.stopPropagation();
               onSelectTeam('');
               setSearchTerm('');
             }}
             className="text-blue-300 hover:text-white p-1 shrink-0"
             title="Quitar equipo destacado"
           >
             <X size={14} />
           </button>
        )}
      </div>

      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto text-sm text-slate-800 py-1">
          {filteredTeams.length > 0 ? (
            filteredTeams.map((team, idx) => (
              <li
                key={`search-team-${idx}`}
                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${selectedTeam === team ? 'bg-blue-100 font-bold text-blue-900' : ''}`}
                onClick={() => {
                  onSelectTeam(team);
                  setIsOpen(false);
                }}
              >
                {team}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-slate-400 italic">No se encontraron equipos...</li>
          )}
        </ul>
      )}
    </div>
  );
};


// --- PANTALLA PRINCIPAL Y ESTADOS ---
export default function App() {
  const [appMode, setAppMode] = useState('loading'); 
  
  const [brackets, setBrackets] = useState([]); 
  const [activeBracketId, setActiveBracketId] = useState(null);
  const activeBracket = brackets.find(b => b.id === activeBracketId);

  const [user, setUser] = useState(null);
  const [firebaseError, setFirebaseError] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
  const [bracketToDelete, setBracketToDelete] = useState(null);
  const [myTeam, setMyTeam] = useState("");

  const fileInputBases = useRef(null);
  const fileInputClasif = useRef(null);
  const fileInputResults = useRef(null);

  // --- EFECTOS DE FIREBASE Y AUTH ---
  useEffect(() => {
    if (!auth) {
      setFirebaseError(true);
      setAppMode('dashboard'); 
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAppMode('dashboard');
      } else {
        setAppMode('login');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname || "scf.usercontent.goog";
        setErrorMsg(`Bloqueo de seguridad: Ve a Firebase Console -> Authentication -> Settings -> Authorized domains y añade: ${domain}`);
      } else {
        setErrorMsg("Error al conectar con Google. Revisa tu configuración de Firebase.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Error en login anónimo:", error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname || "scf.usercontent.goog";
        setErrorMsg(`Bloqueo de seguridad: Ve a Firebase Console -> Authentication -> Settings -> Authorized domains y añade: ${domain}`);
        
        // RESPALDO DE SEGURIDAD: 
        setFirebaseError(true);
        setAppMode('dashboard');
      } else {
        setErrorMsg("Error al iniciar sesión de invitado.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setBrackets([]); 
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  useEffect(() => {
    if (!user || !db) return;
    
    const bracketsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'brackets');
    
    const unsubscribe = onSnapshot(bracketsRef, (snapshot) => {
      const fetchedBrackets = snapshot.docs.map(doc => doc.data());
      const sorted = fetchedBrackets.sort((a, b) => b.createdAt - a.createdAt);
      setBrackets(sorted);
      const lastId = localStorage.getItem('lastActiveBracketId');
      if (lastId && sorted.find(b => b.id === lastId)) {
        setActiveBracketId(lastId);
        setAppMode('bracket');
      }
    }, (error) => {
      console.error("Error sincronizando desde Firestore:", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  const extractTextFromFile = async (file) => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('El PDF tardó demasiado en procesarse. Prueba con otro archivo.')), 30000)
      );
      const extract = async () => {
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
        return text;
      };
      return await Promise.race([extract(), timeout]);
    } else {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
  };

  const callGeminiForBracket = async (basesText, clasifText, userInstructions) => {
    // ⚠️ ATENCIÓN: Esta clave DEBE ser de Google AI Studio (no la de Firebase).
    // Si lo usas desde este chat web, la dejamos vacía para que use la nativa por defecto.
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";    
    const modelName = geminiApiKey ? "gemini-flash-latest" : "gemini-2.5-flash-preview-09-2025";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
    
    let prompt = `
      Actúa como el comité de competición de la Federación de Baloncesto.
      He aquí dos textos extraídos de documentos:
      
      --- DOCUMENTO 1: BASES DE COMPETICIÓN ---
      ${basesText.substring(0, 45000)}
      
      --- DOCUMENTO 2: CLASIFICACIÓN FINAL ---
      ${clasifText.substring(0, 45000)}
      
      INSTRUCCIONES CRÍTICAS PARA GENERAR EL CUADRO:
      1. Identifica qué competición es y localiza las reglas para la Primera Ronda de Eliminatorias/Playoffs.
      2. Identifica el número de partidos (cruces) que hay en esta primera ronda (SIEMPRE potencia de 2: 8, 16...).
      3. Analiza las bases de competición paso a paso. Busca qué posición de qué grupo juega cada partido (Ej. "1º Gr.1 Oro contra 2º Gr. 4 Plata").
      4. Busca en la Clasificación el nombre real de los equipos que ocupan esas posiciones. ¡Atención! Cruza bien el número de grupo y la posición (Ej. Busca exactamente al 2º del Grupo 1 y pon su nombre real).
      5. Construye el array "initialMatches" con la cantidad de partidos detectada.
      6. IMPORTANTE EL ORDEN: El array "initialMatches" DEBE ESTAR ORDENADO EXACTAMENTE EN ESTA SECUENCIA MATEMÁTICA PARA QUE EL CUADRO SE DIBUJE BIEN:
         - Si son 16 partidos, el orden del array DEBE SER los Partidos: 1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11.
         - Si son 8 partidos, el orden del array DEBE SER los Partidos: 1, 8, 4, 5, 2, 7, 3, 6.
      7. Si la plaza es directa (Fija), pon el nombre en "team1" o "team2" y deja sus arrays de Opciones VACÍOS [].
      8. Si la plaza es POR SORTEO, deja "team1" o "team2" como null, y pon los posibles rivales en el array "team1Options" o "team2Options".
      9. En "team1Origin" y "team2Origin" detalla de dónde viene esa plaza (Ej. "1º Grupo 1").
      10. Busca el calendario/fechas de la competición y crea el array 'rounds' indicando: 'name', 'dates' (formato "DD/MM/AAAA"), 'format' y 'gamesCount'.
      11. Usa el campo "analysis" para razonar tu lógica de emparejamientos y cruce de datos antes de generar el array.

      DEVUELVE ÚNICAMENTE UN JSON ESTRICTAMENTE VÁLIDO.
      {
        "tournamentName": "Nombre Competición",
        "analysis": "Razonamiento paso a paso...",
        "rounds": [
          { "name": "Dieciseisavos", "dates": ["12/04/2026", "19/04/2026", "26/04/2026"], "format": "Mejor de 3", "gamesCount": 3 }
        ],
        "initialMatches": [
          {
            "title": "Partido 1",
            "team1": "Nombre",
            "team1Origin": "1º Gr. 1",
            "team1Options": [],
            "team2": null,
            "team2Origin": "Sorteo Bombo B",
            "team2Options": ["A", "B", "C", "D"]
          }
        ]
      }
    `;

    if (userInstructions && userInstructions.trim() !== '') {
      prompt += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO:\n${userInstructions.trim()}`;
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    let delay = 1000;
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (response.status === 429) {
           setErrorMsg("Demasiadas peticiones a Gemini. Google ha limitado tu cuota. Espera 60 segundos.");
           throw new Error("RATE_LIMIT");
        }
        
        if (response.status === 403) {
           setErrorMsg("Error 403: La API Key que has puesto no tiene acceso a la IA (es probable que hayas usado la clave de Firebase). Déjala vacía si usas este visor web.");
           throw new Error("FORBIDDEN");
        }
        
        if (!response.ok) {
           const errData = await response.text();
           console.error("Detalle del error de Gemini:", errData);
           throw new Error('API Error');
        }
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        console.log("Respuesta raw de Gemini:", responseText);
        console.log("JSON limpio:", cleanText);
        return JSON.parse(cleanText);        
      } catch (err) {
          console.error(`Intento ${i+1} fallido:`, err);
          if (err.message === "RATE_LIMIT" || err.message === "FORBIDDEN") break;
          if (i === 4) throw new Error("Fallo en la comunicación con la IA.");
          await new Promise(res => setTimeout(res, delay));
          delay *= 2;
        }
    }
  };

  const callGeminiForResults = async (bracketStateSimplified, resultsText) => {
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; // ⚠️ DEJAR VACÍO SI SE USA EN EL CANVAS
    const modelName = geminiApiKey ? "gemini-flash-latest" : "gemini-2.5-flash-preview-09-2025";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

    let prompt = `
      Actúa como un asistente de datos deportivos.
      JSON del cuadro: ${JSON.stringify(bracketStateSimplified)}
      Texto del acta: ${resultsText.substring(0, 45000)}

      Extrae las puntuaciones reales del documento para los partidos del cuadro.
      Devuelve ÚNICAMENTE un JSON con la estructura:
      {
        "updatedMatches": [
          { "id": "R1-M0", "scores": [{ "s1": "85", "s2": "80" }, { "s1": "", "s2": "" }, { "s1": "", "s2": "" }] }
        ]
      }
    `;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    let delay = 1000;
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (response.status === 429) throw new Error("RATE_LIMIT");
        if (response.status === 403) {
           setErrorMsg("Error 403: API Key incorrecta para la IA de Gemini.");
           throw new Error("FORBIDDEN");
        }
        if (!response.ok) {
           const errData = await response.text();
           console.error("Detalle del error de Gemini:", errData);
           throw new Error('API Error');
        }
        
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
      } catch (err) {
        if (err.message === "RATE_LIMIT") {
           setErrorMsg("Límite de peticiones de Google alcanzado. Espera un minuto.");
           break;
        }
        if (err.message === "FORBIDDEN") break;
        if (i === 4) throw new Error("Fallo procesando los resultados.");
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  };

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

      setProcessStatus('La IA está analizando minuciosamente los cruces y grupos...');
      const aiData = await callGeminiForBracket(basesText, clasifText, customPrompt);

      if (!aiData || !aiData.initialMatches) {
         throw new Error("No se recibió información válida de la IA.");
      }

      setProcessStatus('Generando Bracket Dinámico...');

      const bracketDynamicTree = buildDynamicBracket(aiData.initialMatches, aiData.rounds);

      const allTeamsSet = new Set();
      aiData.initialMatches.forEach(m => {
        if (m.team1) allTeamsSet.add(m.team1);
        if (m.team2) allTeamsSet.add(m.team2);
        if (m.team1Options) m.team1Options.forEach(t => allTeamsSet.add(t));
        if (m.team2Options) m.team2Options.forEach(t => allTeamsSet.add(t));
      });
      const parsedAllTeams = Array.from(allTeamsSet).sort();

      const newBracketObj = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        name: newBracketName.trim(),
        tournamentNameDetected: aiData.tournamentName,
        initialMatchesArray: aiData.initialMatches, 
        roundsData: aiData.rounds || [], 
        allTeams: parsedAllTeams,
        bracketData: bracketDynamicTree
      };

      setBrackets(prev => [newBracketObj, ...prev]);
      setActiveBracketId(newBracketObj.id);
      localStorage.setItem('lastActiveBracketId', newBracketObj.id);

      // Firestore en background — que no bloquee la UI
      if (user && db) {
        setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', newBracketObj.id), newBracketObj)
          .catch(e => console.warn("No se pudo guardar en la nube:", e));
      }
      
      setTimeout(() => {
        setAppMode('bracket');
        setIsProcessing(false);
        setNewBracketName('');
        setBasesFile(null);
        setClasifFile(null);
        setCustomPrompt('');
      }, 500);

    } catch (err) {
      console.error(err);
      if (err.message !== "RATE_LIMIT" && err.message !== "FORBIDDEN") {
          setErrorMsg(err.message || "Ocurrió un error inesperado al procesar los documentos.");
      }
      setIsProcessing(false);
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

      const aiResults = await callGeminiForResults(simplifiedBracket, resultsText);

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
      if(fileInputResults.current) fileInputResults.current.value = ''; 
    }
  };

  const updateActiveBracketData = async (updaterFn) => {
    const bracket = brackets.find(b => b.id === activeBracketId);
    if (!bracket) return;

    const newBracketData = updaterFn(bracket.bracketData);
    const updatedBracket = { ...bracket, bracketData: newBracketData };

    setBrackets(prevBrackets => prevBrackets.map(b => b.id === activeBracketId ? updatedBracket : b));

    if (user && db) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', updatedBracket.id), updatedBracket);
      } catch (e) {
        console.error("Error guardando en la nube", e);
      }
    }
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
      setBrackets(prev => prev.filter(b => b.id !== bracketToDelete));
      if (user && db) {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', bracketToDelete));
      }
      setBracketToDelete(null);
    }
  };

  // PANTALLAS
  if (appMode === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={48} className="text-blue-600 animate-spin" />
      </div>
    );
  }

  if (appMode === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-blue-900 p-8 text-center text-white">
            <Trophy size={48} className="mx-auto mb-4 text-amber-400" />
            <h1 className="text-3xl font-bold tracking-wide">FBM Brackets</h1>
            <p className="text-blue-200 mt-2">Gestiona tus playoffs en la nube</p>
          </div>
          <div className="p-8 text-center">
            <p className="text-slate-600 mb-8">
              Inicia sesión para crear tus cuadros, autocompletar resultados con IA y sincronizarlos automáticamente en todos tus dispositivos.
            </p>
            
            {errorMsg && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-left leading-tight">{errorMsg}</div>}

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-blue-500 text-slate-700 hover:bg-blue-50 px-6 py-3 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 size={20} className="animate-spin text-blue-600"/> : <LogIn size={20} className="text-blue-600" />}
                {isLoggingIn ? "Conectando..." : "Continuar con Google"}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-medium">o prueba rápido</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button 
                onClick={handleAnonymousLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 bg-slate-100 text-slate-600 hover:bg-slate-200 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                <User size={20} className="text-slate-500" />
                Continuar como Invitado
              </button>
            </div>
            
            <p className="mt-6 text-xs text-slate-400">
              Al entrar como invitado, los datos solo se guardarán temporalmente en tu navegador actual.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (appMode === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-100 p-6 sm:p-12 font-sans">
        {bracketToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold mb-2 text-slate-800">¿Eliminar Torneo?</h3>
              <p className="text-slate-600 mb-6 text-sm">Esta acción borrará el torneo y todos sus resultados permanentemente.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setBracketToDelete(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition">Cancelar</button>
                <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm">Sí, eliminar</button>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-5xl mx-auto">
          {/* Header del Dashboard con usuario y Logout */}
          <div className="flex justify-end mb-4">
             {user && (
               <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
                 <div className="flex items-center gap-2">
                   {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{user.email ? user.email.charAt(0).toUpperCase() : 'I'}</div>}
                   <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.isAnonymous ? 'Invitado' : (user.displayName || user.email)}</span>
                 </div>
                 <div className="w-px h-4 bg-slate-300"></div>
                 <button onClick={handleLogout} className="text-slate-500 hover:text-red-500 flex items-center gap-1 text-sm font-medium transition">
                   <LogOut size={16} /> Salir
                 </button>
               </div>
             )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3"><Trophy className="text-amber-500" size={36} /> Mis Torneos</h1>
              <p className="text-slate-500 mt-2">Plataforma dinámica de cuadros deportivos impulsada por IA.</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${firebaseError ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                 {firebaseError ? <CloudOff size={14} /> : <Cloud size={14} />}
                 {firebaseError ? 'Solo Local' : 'Guardado en la Nube'}
              </div>
              <button onClick={() => setAppMode('upload')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"><Plus size={20} /> Nuevo Cuadro IA</button>
            </div>
          </div>

          {firebaseError && (
             <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-xl mb-6 flex items-center gap-3">
                ⚠️ Estás usando la aplicación sin configurar la Autenticación de Firebase localmente. Los torneos se borrarán si recargas la página.
             </div>
          )}

          {brackets.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center shadow-sm">
              <FolderOpen size={64} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">Aún no tienes torneos creados</h3>
              <p className="text-slate-500 mb-6">Sube las bases de la FBM y tu clasificación para empezar.</p>
              <button onClick={() => setAppMode('upload')} className="text-blue-600 font-bold hover:underline">Analizar competición ahora</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {brackets.map(b => (
                <div key={`bracket-card-${b.id}`} className="bg-white rounded-xl shadow-md border border-slate-200 p-6 flex flex-col hover:shadow-xl transition-shadow">
                  <h3 className="text-xl font-bold text-slate-800 mb-2 truncate">{b.name}</h3>
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-4 truncate">{b.tournamentNameDetected || 'Competición'}</p>
                  <div className="flex justify-between items-center mt-auto border-t border-slate-100 pt-4">
                    <button onClick={() => { setActiveBracketId(b.id); localStorage.setItem('lastActiveBracketId', b.id); setAppMode('bracket'); setZoom(1); }} className="text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1">Abrir cuadro <ArrowRight size={16} /></button>
                    <button onClick={() => handleDeleteBracket(b.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (appMode === 'upload') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-blue-900 p-8 text-center text-white relative">
            <button onClick={() => setAppMode('dashboard')} className="absolute left-6 top-8 text-blue-200 hover:text-white flex items-center gap-1 transition-colors"><ChevronLeft size={20} /> Volver</button>
            <Trophy size={48} className="mx-auto mb-4 text-amber-400" />
            <h1 className="text-3xl font-bold tracking-wide">Bracket IA Dinámico</h1>
          </div>
          <div className="p-8">
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Torneo</label>
              <input type="text" value={newBracketName} onChange={(e) => { setNewBracketName(e.target.value); setErrorMsg(''); }} placeholder="Ej. Benjamín Masculino 2º Año" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${basesFile ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`} onClick={() => !isProcessing && fileInputBases.current?.click()}>
                <input type="file" className="hidden" ref={fileInputBases} accept=".pdf" onChange={(e) => setBasesFile(e.target.files[0])} />
                {basesFile ? <div className="flex flex-col items-center"><CheckCircle size={32} className="text-indigo-600" /> <span className="text-xs mt-1 truncate w-full px-2">{basesFile.name}</span></div> : <div className="flex flex-col items-center text-slate-500"><FileText size={32} /> <span className="font-medium">1. Subir Bases</span></div>}
              </div>
              <div className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${clasifFile ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`} onClick={() => !isProcessing && fileInputClasif.current?.click()}>
                <input type="file" className="hidden" ref={fileInputClasif} accept=".pdf" onChange={(e) => setClasifFile(e.target.files[0])} />
                {clasifFile ? <div className="flex flex-col items-center"><CheckCircle size={32} className="text-indigo-600" /> <span className="text-xs mt-1 truncate w-full px-2">{clasifFile.name}</span></div> : <div className="flex flex-col items-center text-slate-500"><UploadCloud size={32} /> <span className="font-medium">2. Subir Clasificación</span></div>}
              </div>
            </div>
            <div className="mb-2">
              <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <MessageSquare size={16} className="text-slate-500" />
                Contexto Adicional (Opcional)
              </label>
              <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="Puedes darle pistas a la IA: 'Presta mucha atención al orden matemático de los cruces de Benjamín', 'Prioriza a UROS DE RIVAS', etc..." disabled={isProcessing} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none h-20 text-sm text-slate-700 placeholder:text-slate-400" />
            </div>
            {errorMsg && <div className="mt-4 p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg text-sm text-center">{errorMsg}</div>}
            {isProcessing ? <div className="mt-6 flex flex-col items-center p-4 bg-indigo-50 rounded-xl"><Loader2 size={32} className="text-indigo-600 animate-spin mb-3" /><span className="text-indigo-800 text-sm font-medium">{processStatus}</span></div> : <button onClick={handleProcessDocuments} disabled={!basesFile || !clasifFile || !newBracketName.trim()} className="mt-6 w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all">Analizar y Construir Cuadro <ArrowRight size={20} /></button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 animate-in fade-in duration-700">
      {isProcessingResults && <div className="fixed inset-0 bg-slate-900/80 z-[60] flex flex-col items-center justify-center p-4 backdrop-blur-sm"><Loader2 size={48} className="text-indigo-400 animate-spin mb-4" /><h3 className="text-2xl font-bold text-white mb-2">Autocompletando...</h3></div>}
      {showResetModal && <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6"><h3 className="text-xl font-bold mb-2">¿Limpiar Puntuaciones?</h3><div className="flex justify-end gap-3 mt-6"><button onClick={() => setShowResetModal(false)} className="px-4 py-2 bg-slate-100 rounded-lg">Cancelar</button><button onClick={confirmReset} className="px-4 py-2 bg-red-600 text-white rounded-lg">Sí, limpiar</button></div></div></div>}
      <header className="bg-blue-900 text-white px-6 py-4 shadow-md flex flex-col lg:flex-row gap-4 justify-between items-center z-10 relative">
        <div className="text-center lg:text-left flex items-center gap-4"><button onClick={() => setAppMode('dashboard')} className="hidden lg:flex p-2 bg-blue-800 rounded-lg"><ChevronLeft size={20} /></button><div><h1 className="text-xl font-bold truncate max-w-xs">{activeBracket.name}</h1><p className="text-blue-200 text-xs font-semibold uppercase">{activeBracket.tournamentNameDetected || 'Estructura Dinámica'}</p></div></div>
        <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
          <div className="relative"><input type="file" className="hidden" ref={fileInputResults} accept=".pdf" onChange={handleResultsUpload} /><button onClick={() => !isProcessingResults && fileInputResults.current?.click()} className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md"><FileDigit size={16} /> ✨ Autocompletar PDF</button></div>
          <TeamSearchableSelect teams={activeBracket.allTeams} selectedTeam={myTeam} onSelectTeam={setMyTeam} />
          <div className="flex gap-3"><div className="flex bg-blue-800 rounded-lg border border-blue-700 shadow-sm hidden sm:flex"><button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))} className="p-2"><ZoomOut size={18} /></button><div className="px-3 py-2 text-sm border-x border-blue-700 w-16 text-center">{Math.round(zoom * 100)}%</div><button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="p-2"><ZoomIn size={18} /></button></div><button onClick={() => setShowResetModal(true)} className="flex items-center gap-2 bg-red-600 px-3 py-2 rounded-lg text-sm font-medium"><RefreshCw size={16} /> <span className="hidden sm:inline">Limpiar</span></button></div>
        </div>
      </header>
      <main className="flex-1 overflow-auto relative p-4 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
        <div className="absolute min-w-max p-12 transition-transform origin-top-center w-full flex justify-center pb-32" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
           <BracketNode nodeId={activeBracket.bracketData.rootId} bracketData={activeBracket.bracketData} onScoreChange={handleScoreChange} onSelectSorteo={handleSorteoSelect} myTeam={myTeam} />
        </div>
      </main>
    </div>
  );
}