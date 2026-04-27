import React from 'react';

export default function PlayoffsBracketScene({ reduced = false }) {
  return (
    <div
      className="fm-scene fm-bracket-scene"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-playoffs"
      aria-hidden="true"
    >
      <svg viewBox="0 0 140 70" className="h-full w-full">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path className="fm-bracket-line" d="M18 16h22v12h18" />
          <path className="fm-bracket-line" d="M18 54h22V42h18" />
          <path className="fm-bracket-line" d="M82 29h18" />
          <path className="fm-bracket-line" d="M18 16h12" />
          <path className="fm-bracket-line" d="M18 54h12" />
          <path className="fm-bracket-line" d="M82 29h8" />
        </g>
        {[12, 28, 42, 58].map((y) => (
          <rect key={y} className="fm-bracket-node" x="8" y={y - 5} rx="5" width="24" height="10" />
        ))}
        {[24, 46].map((y) => (
          <rect key={y} className="fm-bracket-node" x="58" y={y - 5} rx="5" width="24" height="10" />
        ))}
        <rect className="fm-bracket-node fm-bracket-node-final" x="100" y="24" rx="5" width="24" height="12" />
      </svg>
    </div>
  );
}
