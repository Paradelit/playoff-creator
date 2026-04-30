import React from 'react';
import { tokens } from '../../../design/tokens';

/**
 * Mini halfcourt with scattered shot markers. Made shots = filled Court Orange
 * dot, missed shots = Score-Clock Cyan X. Mirrors the visual language of the
 * real ScoutingScreen, where coaches see shot maps per game.
 */

const SHOTS = [
  { x: 50, y: 14, made: true },
  { x: 32, y: 22, made: true },
  { x: 70, y: 24, made: false },
  { x: 26, y: 38, made: true },
  { x: 76, y: 38, made: true },
  { x: 50, y: 44, made: false },
  { x: 18, y: 60, made: true },
  { x: 84, y: 60, made: true },
  { x: 50, y: 64, made: false },
];

export default function ScoutingHeatmapScene({ reduced = false }) {
  return (
    <div
      className="fm-scene flex items-center justify-center"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-scouting"
      aria-hidden="true"
      style={{ minHeight: 92 }}
    >
      <svg viewBox="0 0 100 80" className="h-full max-h-[88px] w-full" preserveAspectRatio="xMidYMid meet">
        <g fill="none" stroke={tokens.ink400} strokeWidth="0.6" strokeLinecap="round">
          <rect x="6" y="4" width="88" height="72" rx="2" />
          <rect x="36" y="4" width="28" height="22" />
          <path d="M 36 26 A 14 14 0 0 0 64 26" />
          <path d="M 14 4 L 14 18 A 36 36 0 0 0 86 18 L 86 4" />
          <line x1="44" y1="6" x2="56" y2="6" stroke={tokens.ink400} strokeWidth="1" />
          <circle cx="50" cy="9" r="1.4" fill="none" stroke={tokens.courtOrange} strokeWidth="0.8" />
        </g>

        {SHOTS.map((shot, idx) => {
          const animationDelay = reduced ? '0ms' : `${idx * 70}ms`;
          if (shot.made) {
            return (
              <g
                key={idx}
                className="ds-scout-shot-made"
                style={{ transformOrigin: `${shot.x}px ${shot.y}px`, transformBox: 'fill-box' }}
              >
                <circle
                  cx={shot.x}
                  cy={shot.y}
                  r="2.6"
                  fill={tokens.courtOrange}
                  opacity="0.95"
                  style={{
                    transformOrigin: `${shot.x}px ${shot.y}px`,
                    animation: reduced ? 'none' : `fadeUp 0.4s ease ${animationDelay} backwards`,
                  }}
                />
                <circle
                  cx={shot.x}
                  cy={shot.y}
                  r="4.2"
                  fill="none"
                  stroke={tokens.courtOrange}
                  strokeWidth="0.5"
                  opacity="0.4"
                />
              </g>
            );
          }
          return (
            <g
              key={idx}
              stroke={tokens.scoreClockBlue}
              strokeWidth="1.2"
              strokeLinecap="round"
              style={{
                transformOrigin: `${shot.x}px ${shot.y}px`,
                animation: reduced ? 'none' : `fadeUp 0.4s ease ${animationDelay} backwards`,
              }}
            >
              <line x1={shot.x - 2} y1={shot.y - 2} x2={shot.x + 2} y2={shot.y + 2} />
              <line x1={shot.x + 2} y1={shot.y - 2} x2={shot.x - 2} y2={shot.y + 2} />
            </g>
          );
        })}

        <g fontFamily="ui-sans-serif, system-ui, sans-serif" fill={tokens.ink500}>
          <text x="6" y="78" fontSize="4.5" fontWeight="700" letterSpacing="0.06em">
            6/9 · eFG 67%
          </text>
        </g>

        <g className="ds-scout-callout" aria-hidden="true">
          <rect
            x="56"
            y="32"
            width="40"
            height="14"
            rx="3"
            fill="rgba(15,23,42,0.92)"
            stroke="rgba(249,115,22,0.45)"
            strokeWidth="0.5"
          />
          <text
            x="76"
            y="40"
            textAnchor="middle"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="3.5"
            fontWeight="700"
            fill="#fb923c"
            letterSpacing="0.10em"
          >
            INSIGHT
          </text>
          <text
            x="76"
            y="44.5"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="3"
            fontWeight="600"
            fill="#FFFFFF"
          >
            7/9 esquina derecha
          </text>
        </g>
      </svg>
    </div>
  );
}
