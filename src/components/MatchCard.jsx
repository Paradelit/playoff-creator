import React from 'react';
import { Trophy, Calendar } from 'lucide-react';

const MatchCard = React.memo(({ match, bracketData, onScoreChange, onSelectSorteo, isFinal, myTeam, readOnly }) => {
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
              onChange={(e) => !readOnly && onSelectSorteo(match.id, teamIndex, e.target.value)}
              disabled={readOnly}
              className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 font-normal bg-white disabled:opacity-60 disabled:cursor-not-allowed"
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
                onChange={(e) => !readOnly && onScoreChange(match.id, teamIndex, gIdx, e.target.value)}
                disabled={disabledGame || readOnly}
                placeholder={!disabledGame && match.gamesCount > 1 ? `J${gIdx + 1}` : "-"}
                className={`${inputBaseClass} ${disabledClass}`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div data-match-id={match.id} className={`relative flex flex-col min-w-[380px] sm:w-[460px] bg-white border ${isFinal ? 'border-amber-400 shadow-amber-200 shadow-lg' : 'border-slate-300 shadow-md'} rounded-lg overflow-hidden transition-all hover:shadow-lg`}>
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
});

export default MatchCard;
