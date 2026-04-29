import React from 'react';
import { tokens } from '../../../design/tokens';

/**
 * Mini-replica of the real WeekView. 3 columns (Sáb/Dom/Lun) with day-name +
 * circular date pill (amber today), sessions as colored chips matching the real
 * WeekView color rules: bg-rose-500 partido / bg-amber-500 playoff /
 * team-colored training.
 */

const DAYS = [
  {
    label: 'Sáb',
    date: 12,
    today: true,
    sessions: [
      { kind: 'training', team: 'Cadete A', color: tokens.scoreClockBlue },
      { kind: 'partido', team: 'vs Estudiantes', color: tokens.rosePartido },
      { kind: 'training', team: 'Mini Mixto', color: tokens.courtOrange },
    ],
  },
  {
    label: 'Dom',
    date: 13,
    today: false,
    sessions: [
      { kind: 'playoff', team: 'PO vs RM', color: tokens.trophyAmberDeep },
      { kind: 'training', team: 'Infantil A', color: '#10B981' },
    ],
  },
  {
    label: 'Lun',
    date: 14,
    today: false,
    sessions: [{ kind: 'training', team: 'Sénior', color: tokens.scoreClockBlueDeep }],
  },
];

export default function CalendarBlocksScene({ reduced = false }) {
  return (
    <div className="fm-scene" data-reduced={reduced ? 'true' : 'false'} data-testid="scene-calendar" aria-hidden="true">
      <div
        className="overflow-hidden rounded-md"
        style={{ background: tokens.surfaceWhite, border: `1px solid ${tokens.ash200}` }}
      >
        <div className="grid grid-cols-3">
          {DAYS.map((day, dayIdx) => (
            <div
              key={day.label}
              className="flex flex-col last:border-r-0"
              style={{ borderRight: dayIdx < DAYS.length - 1 ? `1px solid ${tokens.ash100}` : 'none' }}
            >
              <div
                className="flex flex-col items-center gap-0.5 py-0.5"
                style={{
                  borderBottom: `1px solid ${tokens.ash100}`,
                  background: day.today ? '#FEF3C7' : tokens.surfaceWhite,
                }}
              >
                <span className="text-[8px] font-semibold uppercase" style={{ color: tokens.ink500 }}>
                  {day.label}
                </span>
                <span
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8.5px] font-bold leading-none"
                  style={{
                    background: day.today ? tokens.trophyAmber : 'transparent',
                    color: day.today ? tokens.surfaceWhite : tokens.ink700,
                  }}
                >
                  {day.date}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 p-0.5">
                {day.sessions.map((session) => (
                  <span
                    key={`${day.label}-${session.team}`}
                    className={`ds-cal-chip ds-cal-chip-${dayIdx + 1} truncate rounded px-1 py-0.5 text-[8px] font-semibold leading-none text-white`}
                    style={{ background: session.color }}
                  >
                    {session.kind === 'partido' ? '🏀 ' : session.kind === 'playoff' ? '🏆 ' : ''}
                    {session.team}
                  </span>
                ))}
                {day.sessions.length === 0 ? <span className="h-3" /> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
