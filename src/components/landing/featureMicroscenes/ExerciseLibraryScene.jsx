import React from 'react';
import { tokens } from '../../../design/tokens';

/**
 * Mini-replica of three real ExerciseCards fanned out: white rounded-xl with
 * shadow, top section showing a halfcourt canvas (paint + 3pt arc + 2 player
 * dots + arrow), bottom showing a tag chip.
 */

const EXERCISES = [
  {
    id: 'pnr',
    tag: 'P&R',
    tagColor: tokens.courtOrange,
    rotation: -3,
    offsetX: -22,
    offsetY: 4,
    hoverRotation: -8,
    hoverOffsetX: -34,
    hoverOffsetY: 0,
  },
  {
    id: 'tiro',
    tag: 'Tiro',
    tagColor: tokens.scoreClockBlue,
    rotation: 0,
    offsetX: 0,
    offsetY: -2,
    hoverRotation: 0,
    hoverOffsetX: 0,
    hoverOffsetY: -8,
  },
  {
    id: 'trans',
    tag: 'Trans.',
    tagColor: tokens.successGreen,
    rotation: 3,
    offsetX: 22,
    offsetY: 4,
    hoverRotation: 8,
    hoverOffsetX: 34,
    hoverOffsetY: 0,
  },
];

export default function ExerciseLibraryScene({ reduced = false }) {
  return (
    <div
      className="fm-scene relative flex items-center justify-center"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-library"
      aria-hidden="true"
      style={{ minHeight: 96 }}
    >
      {EXERCISES.map((exercise, idx) => (
        <article
          key={exercise.id}
          className="ds-exercise-card absolute overflow-hidden rounded-md"
          style={{
            width: 64,
            background: tokens.surfaceWhite,
            border: `1px solid ${tokens.ash200}`,
            boxShadow: '0 4px 10px -2px rgba(15,23,42,0.12), 0 1px 2px rgba(15,23,42,0.06)',
            transform: `translateX(${exercise.offsetX}px) translateY(${exercise.offsetY}px) rotate(${exercise.rotation}deg)`,
            '--hover-transform': `translateX(${exercise.hoverOffsetX}px) translateY(${exercise.hoverOffsetY}px) rotate(${exercise.hoverRotation}deg)`,
            zIndex: idx === 1 ? 3 : 2,
            transition: reduced ? 'none' : 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div
            className="px-1 py-1.5"
            style={{ background: tokens.ash50, borderBottom: `1px solid ${tokens.ash100}` }}
          >
            <CourtMini accent={exercise.tagColor} />
          </div>
          <div className="px-1.5 py-1">
            <span
              className="inline-block rounded px-1 py-px text-[7.5px] font-bold uppercase leading-none tracking-[0.06em] text-white"
              style={{ background: exercise.tagColor }}
            >
              {exercise.tag}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function CourtMini({ accent }) {
  return (
    <svg viewBox="0 0 64 36" className="block h-7 w-full">
      <g fill="none" stroke={tokens.ink400} strokeWidth="0.7" strokeLinecap="round">
        <rect x="3" y="3" width="58" height="30" rx="1.5" />
        <rect x="22" y="3" width="20" height="14" />
        <path d="M 22 17 A 10 10 0 0 0 42 17" />
        <path d="M 8 3 L 8 11 A 24 24 0 0 0 56 11 L 56 3" />
      </g>
      <circle cx="20" cy="22" r="2" fill={tokens.ink900} />
      <circle cx="44" cy="22" r="2" fill={tokens.ink900} />
      <path
        d="M 22 22 L 42 22"
        stroke={accent}
        strokeWidth="1.4"
        strokeLinecap="round"
        markerEnd="url(#arrow)"
        fill="none"
      />
      <circle cx="42" cy="22" r="1.5" fill={accent} />
    </svg>
  );
}
