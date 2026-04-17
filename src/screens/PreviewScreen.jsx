import React, { useEffect, useState } from 'react';
import { ChevronLeft, ZoomOut, ZoomIn, CheckCircle, ShieldHalf, ChevronDown, Undo2, Redo2 } from 'lucide-react';
import BracketNode from '../components/BracketNode';
import AIFeedback from '../components/AIFeedback';
import { useBracket } from '../contexts/BracketContext';
import { useProfile } from '../hooks/useProfile';

function bestTeamMatch(allTeams, clubName, teamName) {
  if (!allTeams || allTeams.length === 0) return null;
  const needles = [clubName, teamName].filter(Boolean).map((s) => s.toLowerCase().trim());
  if (needles.length === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const t of allTeams) {
    const lower = t.toLowerCase();
    let score = 0;
    for (const needle of needles) {
      // Check if any word from needle appears in the team name
      const words = needle.split(/\s+/).filter((w) => w.length > 2);
      for (const word of words) {
        if (lower.includes(word)) score += word.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  // Only return if we matched at least one significant word
  return bestScore >= 3 ? best : null;
}

export default function PreviewScreen() {
  const {
    pendingBracket,
    setPendingBracket,
    previewZoom,
    setPreviewZoom,
    handleConfirmBracket,
    setAppMode,
    pendingTeamObj,
    lastTraceId,
    handleScoreChange,
    handleSorteoSelect,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useBracket();
  const { profile } = useProfile();
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  const allTeams = pendingBracket?.allTeams || [];
  const clubName = profile?.nombreClub || '';

  // Auto-detect best matching team when bracket is loaded
  useEffect(() => {
    if (!pendingBracket || pendingBracket.myTeam || allTeams.length === 0) return;
    const teamName = pendingTeamObj ? `${pendingTeamObj.categoria || ''} ${pendingTeamObj.letra || ''}` : '';
    const suggested = bestTeamMatch(allTeams, clubName, teamName);
    if (suggested) {
      setPendingBracket((prev) => ({ ...prev, myTeam: suggested }));
    }
  }, [allTeams.length, clubName, pendingTeamObj]); // eslint-disable-line react-hooks/exhaustive-deps

  const myTeam = pendingBracket?.myTeam || '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-blue-900 text-white px-4 py-3 shadow-md flex items-center justify-between gap-3 z-10 relative">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              setAppMode('upload');
              setPendingBracket(null);
            }}
            aria-label="Volver"
            className="p-2 bg-blue-800 rounded-lg shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex flex-col gap-0.5">
            <input
              className="text-base lg:text-xl font-bold bg-transparent border-b border-blue-500 focus:outline-none focus:border-white text-white truncate w-full"
              value={pendingBracket.name}
              onChange={(e) => setPendingBracket((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del cuadro"
            />
            <input
              className="text-blue-200 text-xs font-semibold uppercase bg-transparent border-b border-blue-700 focus:outline-none focus:border-blue-300 truncate w-full"
              value={pendingBracket.tournamentNameDetected || ''}
              onChange={(e) => setPendingBracket((prev) => ({ ...prev, tournamentNameDetected: e.target.value }))}
              placeholder="Nombre del torneo"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-blue-800 rounded-lg border border-blue-700">
            <button
              onClick={() => setPreviewZoom((z) => Math.max(0.3, z - 0.1))}
              aria-label="Reducir zoom"
              className="p-2"
            >
              <ZoomOut size={18} />
            </button>
            <div className="px-3 py-2 text-sm border-x border-blue-700 w-16 text-center">
              {Math.round(previewZoom * 100)}%
            </div>
            <button
              onClick={() => setPreviewZoom((z) => Math.min(1.5, z + 0.1))}
              aria-label="Aumentar zoom"
              className="p-2"
            >
              <ZoomIn size={18} />
            </button>
          </div>
          <div className="flex bg-blue-800 rounded-lg border border-blue-700">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Deshacer"
              title="Deshacer (Ctrl+Z)"
              className="p-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label="Rehacer"
              title="Rehacer (Ctrl+Y)"
              className="p-2 border-l border-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Redo2 size={18} />
            </button>
          </div>
          <button
            onClick={() => {
              setAppMode('upload');
              setPendingBracket(null);
            }}
            className="px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-bold rounded-lg"
          >
            Descartar
          </button>
          <button
            onClick={handleConfirmBracket}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-lg flex items-center gap-2"
          >
            <CheckCircle size={16} /> Confirmar y guardar
          </button>
        </div>
      </header>

      {/* Team selector banner */}
      <div className="bg-blue-950 border-b border-blue-800 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldHalf size={16} className="text-amber-400 shrink-0" />
          <span className="text-blue-300 text-sm font-medium shrink-0">Mi equipo en el cuadro:</span>
          <div className="relative">
            <button
              onClick={() => setShowTeamPicker(!showTeamPicker)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition ${myTeam ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-blue-800 text-blue-300 border border-blue-700'}`}
            >
              {myTeam || 'Seleccionar equipo'}
              <ChevronDown size={14} />
            </button>
            {showTeamPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-60 overflow-y-auto z-50 min-w-[240px]">
                <button
                  onClick={() => {
                    setPendingBracket((prev) => ({ ...prev, myTeam: null }));
                    setShowTeamPicker(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-50 border-b border-slate-100"
                >
                  Ninguno
                </button>
                {allTeams.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setPendingBracket((prev) => ({ ...prev, myTeam: t }));
                      setShowTeamPicker(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition ${t === myTeam ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-700'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {myTeam && (
          <span className="text-xs text-blue-400 shrink-0 hidden sm:block">
            Se destacará en el cuadro y aparecerá en tu calendario
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] p-4">
        <div
          className="absolute min-w-max p-12 w-full flex justify-center pb-32"
          style={{ transform: `scale(${previewZoom})`, transformOrigin: 'top center' }}
        >
          <BracketNode
            nodeId={pendingBracket.bracketData.rootId}
            bracketData={pendingBracket.bracketData}
            onScoreChange={handleScoreChange}
            onSelectSorteo={handleSorteoSelect}
            myTeam={myTeam}
            readOnly={false}
          />
        </div>
      </div>

      {/* AI Feedback */}
      <div className="bg-white border-t border-slate-200 px-4 py-2 flex justify-end">
        <AIFeedback traceId={lastTraceId} />
      </div>
    </div>
  );
}
