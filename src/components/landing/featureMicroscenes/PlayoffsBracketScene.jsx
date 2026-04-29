import React from 'react';
import { Trophy } from 'lucide-react';
import { tokens } from '../../../design/tokens';

/**
 * Mini-replica of the real bracket. Two MatchCard-style stubs on the left feeding
 * into a Final cell on the right. Final is bordered amber-400 with Trophy icons,
 * matching MatchCard.jsx isFinal styling. Connectors are 2px lines turning amber
 * on the my-team path (top one, since "Cadete A" is the simulated my-team).
 */
const QF_MATCHES = [
  { team1: 'Cadete A', team2: 'Junior A', myTeam: true, winner: 'Cadete A' },
  { team1: 'Inf. A', team2: 'Mini', myTeam: false },
];

export default function PlayoffsBracketScene({ reduced = false }) {
  return (
    <div
      className="fm-scene relative grid h-full w-full grid-cols-[minmax(0,1fr)_18px_minmax(0,1.05fr)] items-center gap-1"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-playoffs"
      aria-hidden="true"
      style={{ minHeight: 88 }}
    >
      <div className="flex flex-col gap-1.5">
        {QF_MATCHES.map((match, idx) => (
          <MiniMatchCard
            key={idx}
            team1={match.team1}
            team2={match.team2}
            winner={match.winner}
            myTeam={match.myTeam ? match.team1 : null}
          />
        ))}
      </div>

      <Connectors />

      <MiniFinalCard champion="Cadete A" rival="Por determinar" />
    </div>
  );
}

function MiniMatchCard({ team1, team2, winner, myTeam }) {
  const renderRow = (team) => {
    const isWinner = winner === team;
    const isMyTeam = myTeam === team;
    let background = tokens.surfaceWhite;
    let color = tokens.ink900;
    if (isMyTeam && isWinner) {
      background = '#FEF3C7';
      color = '#92400E';
    } else if (isWinner) {
      background = '#DCFCE7';
      color = '#166534';
    } else if (winner) {
      color = tokens.ink400;
    }
    return (
      <div
        className="flex items-center justify-between border-b px-1.5 py-0.5 last:border-b-0"
        style={{ background, color, borderColor: tokens.ash100 }}
      >
        <span className="truncate text-[8.5px] font-semibold">{team}</span>
        <span className="font-mono text-[8.5px] font-bold tabular-nums">{isWinner ? '78' : winner ? '71' : '—'}</span>
      </div>
    );
  };

  return (
    <div
      className="overflow-hidden rounded"
      style={{
        background: tokens.surfaceWhite,
        border: `1px solid ${tokens.ash200}`,
        boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
      }}
    >
      {renderRow(team1)}
      {renderRow(team2)}
    </div>
  );
}

function MiniFinalCard({ champion, rival }) {
  return (
    <div
      className="overflow-hidden rounded transition-transform duration-300 group-hover:scale-[1.04]"
      style={{
        background: tokens.surfaceWhite,
        border: `1px solid ${tokens.trophyAmber}`,
        boxShadow: `0 4px 10px -2px rgba(239,191,4,0.45), 0 1px 2px rgba(15,23,42,0.06)`,
      }}
    >
      <div
        className="flex items-center justify-center gap-1 px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-white"
        style={{ background: tokens.trophyAmber }}
      >
        <Trophy size={9} aria-hidden="true" />
        Final · BO3
        <Trophy size={9} aria-hidden="true" />
      </div>
      <div className="px-1.5 py-1">
        <p className="m-0 text-[9px] font-bold leading-tight" style={{ color: '#92400E' }}>
          {champion}
        </p>
        <p className="m-0 mt-0.5 text-[8.5px] italic leading-tight" style={{ color: tokens.ink400 }}>
          {rival}
        </p>
      </div>
    </div>
  );
}

function Connectors() {
  return (
    <svg viewBox="0 0 18 60" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
      <path
        className="ds-bracket-amber-path"
        d="M 0 14 H 9 V 30 H 18"
        fill="none"
        stroke={tokens.trophyAmberDeep}
        strokeWidth="1.5"
      />
      <path d="M 0 46 H 9 V 30 H 18" fill="none" stroke={tokens.ash200} strokeWidth="1.5" />
    </svg>
  );
}
