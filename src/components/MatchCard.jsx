import React, { useState } from 'react';
import { Trophy, Calendar, Edit2 } from 'lucide-react';
import { parseDateToISO, isGameSkippedBySeries } from '../utils/calendarUtils';
import { useBracket } from '../contexts/BracketContext';
import PromptDialog from './PromptDialog';
import EditMatchModal from './bracket/EditMatchModal';

const MatchCard = React.memo(
  ({ match, bracketData, onScoreChange, onSelectSorteo, isFinal, myTeam, readOnly, onDateClick }) => {
    const { handleEditTeamName, handleEditMatchSettings } = useBracket();
    const [editingTeamIndex, setEditingTeamIndex] = useState(null);
    const [isEditingMatch, setIsEditingMatch] = useState(false);
    const isReady = match.team1 && match.team2;

    const getUsedOptions = () => {
      return Object.values(bracketData.state)
        .filter((m) => m.round === 1 && m.id !== match.id)
        .flatMap((m) => [m.team1, m.team2])
        .filter(Boolean);
    };

    // Wayfinding via full-row tint (no side-stripes — DESIGN.md ban). myTeam rows
    // wear amber so the "your team's path" reads at a glance even alongside generic
    // winner/loser rows in the same bracket.
    const getRowStyle = (teamName, isWinner, isLoser) => {
      let style = 'flex items-center justify-between px-2 py-2 transition-colors border-b border-slate-100 ';
      if (!teamName && match.team1Options.length === 0 && match.team2Options.length === 0) {
        return style + 'bg-slate-50 text-slate-400';
      }
      if (teamName && teamName === myTeam) {
        if (isWinner) style += 'bg-amber-200 text-amber-900 font-bold ';
        else if (isLoser) style += 'bg-amber-50 text-amber-700/80 opacity-80 ';
        else style += 'bg-amber-100 text-amber-800 font-semibold ';
      } else {
        if (isWinner) style += 'bg-emerald-100 text-emerald-800 font-bold ';
        else if (isLoser) style += 'bg-rose-50 text-rose-500/80 opacity-70 ';
        else style += 'hover:bg-blue-50 text-slate-800 ';
      }
      return style;
    };

    const isGameDisabled = (gIdx) => {
      if (!isReady) return true;
      return isGameSkippedBySeries(match, gIdx);
    };

    // For BO2 / BO3 series, surface the running score so a coach scanning a
    // bracket mid-tournament sees "Cadete A 2-0" without re-reading every input.
    const seriesState = (() => {
      if (!isReady || !match.gamesCount || match.gamesCount < 2) return null;
      let team1Wins = 0;
      let team2Wins = 0;
      let played = 0;
      (match.scores || []).forEach((s) => {
        const a = parseInt(s.s1);
        const b = parseInt(s.s2);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          played += 1;
          if (a > b) team1Wins += 1;
          else if (b > a) team2Wins += 1;
        }
      });
      if (played === 0) return null;
      const target = Math.ceil(match.gamesCount / 2);
      const matchPoint =
        (team1Wins === target - 1 && team2Wins < target) || (team2Wins === target - 1 && team1Wins < target);
      const decided = team1Wins >= target || team2Wins >= target;
      return { team1Wins, team2Wins, matchPoint: matchPoint && !decided, decided };
    })();

    const renderTeamRow = (team, origin, options, scores, teamIndex) => {
      const isWinner = match.winner === team && match.winner;
      const isLoser = match.winner && team && match.winner !== team;
      const isDropdown = options && options.length > 0;

      return (
        <div className={getRowStyle(team, isWinner, isLoser) + (teamIndex === 2 ? ' border-b-0' : '')}>
          <div className="flex flex-col flex-1 overflow-hidden pr-3 justify-center min-h-[32px]">
            <div className="flex items-center gap-1.5 min-w-0 w-full group/edit">
              {isDropdown && !readOnly ? (
                <div className="flex w-full items-center gap-1">
                  <select
                    value={team || ''}
                    onChange={(e) => onSelectSorteo(match.id, teamIndex, e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 font-normal bg-white"
                  >
                    <option key="default-opt" value="">
                      -- Asignar Equipo --
                    </option>
                    {options.map((opt, idx) => (
                      <option
                        key={`opt-${match.id}-${teamIndex}-${idx}`}
                        value={opt}
                        disabled={getUsedOptions().includes(opt)}
                      >
                        {opt}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setEditingTeamIndex(teamIndex)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded shrink-0 opacity-0 group-hover/edit:opacity-100 transition-opacity"
                    title="Editar nombre libremente"
                  >
                    <Edit2 size={12} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div
                  className={`flex items-center min-w-0 gap-1.5 ${!readOnly ? 'cursor-pointer group/name' : ''} w-full`}
                  onClick={() => !readOnly && setEditingTeamIndex(teamIndex)}
                >
                  <span className={`truncate text-sm font-medium ${!team ? 'italic text-slate-400' : ''}`} title={team}>
                    {team || 'Por determinar'}
                  </span>
                  {!readOnly && (
                    <Edit2
                      size={12}
                      className="text-slate-300 group-hover/name:text-blue-600 shrink-0 opacity-0 group-hover/edit:opacity-100 transition-opacity"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )}
            </div>
            {origin && (
              <span className="text-[10px] text-slate-500 truncate mt-0.5 leading-tight font-normal" title={origin}>
                {origin}
              </span>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {scores.map((scoreObj, gIdx) => {
              const disabledGame = isGameDisabled(gIdx);
              const inputBaseClass =
                'w-[72px] h-8 text-center text-sm font-semibold border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
              const disabledClass = disabledGame
                ? 'bg-slate-200 text-transparent opacity-50 cursor-not-allowed border-transparent'
                : 'disabled:bg-slate-100 disabled:text-transparent';
              return (
                <input
                  key={`score-${match.id}-${teamIndex}-${gIdx}`}
                  type="number"
                  value={teamIndex === 1 ? scoreObj.s1 : scoreObj.s2}
                  onChange={(e) => !readOnly && onScoreChange(match.id, teamIndex, gIdx, e.target.value)}
                  disabled={disabledGame || readOnly}
                  placeholder={!disabledGame && match.gamesCount > 1 ? `J${gIdx + 1}` : '-'}
                  className={`${inputBaseClass} ${disabledClass}`}
                />
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div
        data-match-id={match.id}
        className={`relative flex flex-col w-full min-w-0 sm:min-w-[380px] sm:w-[460px] bg-white border ${isFinal ? 'border-amber-400 shadow-amber-200 shadow-lg' : 'border-slate-300 shadow-md'} rounded-lg overflow-hidden transition-all hover:shadow-lg`}
      >
        <div
          onClick={() => !readOnly && setIsEditingMatch(true)}
          className={`relative text-[11px] uppercase tracking-wider font-bold text-center py-1.5 flex items-center justify-center gap-1.5 transition-colors ${
            isFinal
              ? `bg-amber-400 text-white ${!readOnly ? 'hover:bg-amber-500 cursor-pointer' : ''}`
              : `bg-slate-200 text-slate-700 ${!readOnly ? 'hover:bg-blue-100 hover:text-blue-800 cursor-pointer' : ''}`
          }`}
          title={!readOnly ? 'Hacer clic para modificar título y formato' : undefined}
        >
          {isFinal && <Trophy size={14} aria-hidden="true" />}
          {match.title}
          {isFinal && <Trophy size={14} aria-hidden="true" />}
          {!readOnly && <Edit2 size={10} className="opacity-50" aria-hidden="true" />}
        </div>
        <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 px-2 py-1.5">
          <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
            <Calendar size={10} aria-hidden="true" /> {match.format}
            {seriesState && !seriesState.decided && (
              <span
                className={`ml-1.5 normal-case tracking-normal font-bold px-1.5 py-0.5 rounded-full ${seriesState.matchPoint ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}
              >
                {seriesState.team1Wins}-{seriesState.team2Wins}
                {seriesState.matchPoint ? ' · Match point' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-1 justify-end pr-0.5">
            {match.scores.map((_, i) => {
              const rawDate = match.dates?.[i];
              const isoDate = rawDate ? parseDateToISO(rawDate) : null;
              const clickable = onDateClick && isoDate;
              return clickable ? (
                <button
                  key={`date-${i}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateClick(isoDate);
                  }}
                  className={`w-[72px] text-center text-[10px] font-bold tracking-tight underline decoration-dotted ${isGameDisabled(i) ? 'text-slate-300 opacity-50' : 'text-blue-600 hover:text-blue-800 cursor-pointer'}`}
                  title="Ver en calendario"
                >
                  {rawDate}
                </button>
              ) : (
                <div
                  key={`date-${i}`}
                  className={`w-[72px] text-center text-[10px] font-bold tracking-tight ${isGameDisabled(i) ? 'text-slate-300 opacity-50' : 'text-slate-500'}`}
                  title={rawDate}
                >
                  {rawDate || `J${i + 1}`}
                </div>
              );
            })}
          </div>
        </div>
        {renderTeamRow(match.team1, match.team1Origin, match.team1Options, match.scores, 1)}
        {renderTeamRow(match.team2, match.team2Origin, match.team2Options, match.scores, 2)}

        {editingTeamIndex && (
          <PromptDialog
            open={true}
            title={match.title}
            message={`Modifica el nombre del Equipo ${editingTeamIndex}`}
            defaultValue={editingTeamIndex === 1 ? match.team1 || '' : match.team2 || ''}
            placeholder="Ej. Uros de Rivas"
            onConfirm={(val) => {
              handleEditTeamName(match.id, editingTeamIndex, val);
              setEditingTeamIndex(null);
            }}
            onCancel={() => setEditingTeamIndex(null)}
          />
        )}

        {isEditingMatch && (
          <EditMatchModal
            match={match}
            onClose={() => setIsEditingMatch(false)}
            onSave={(newTitle, newGamesCount, schedule) => {
              handleEditMatchSettings(match.id, newTitle, newGamesCount, schedule);
              setIsEditingMatch(false);
            }}
          />
        )}
      </div>
    );
  },
);

export default MatchCard;
