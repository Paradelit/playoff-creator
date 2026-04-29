import React from 'react';
import { tokens } from '../../../design/tokens';

/**
 * Mini-replica of the CuadernoScreen A4 document. Gray-200 backdrop, white sheet
 * with serif text, numbered index entries with dotted leaders and right arrow.
 * Matches the real index in CuadernoScreen.jsx:91-103.
 */

const ENTRIES = [
  { num: 1, title: 'Información' },
  { num: 2, title: 'Pilares del club' },
  { num: 3, title: 'Normas' },
  { num: 7, title: 'Notas' },
];

export default function NotebookNotesScene({ reduced = false }) {
  return (
    <div
      className="fm-scene flex items-center justify-center px-2 py-1"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-notebook"
      aria-hidden="true"
      style={{ background: '#E5E7EB', borderRadius: 6, minHeight: 92 }}
    >
      <div
        className="w-full px-3 py-2 font-serif"
        style={{
          background: tokens.surfaceWhite,
          border: '1px solid #9CA3AF',
          color: tokens.ink900,
          boxShadow: '0 4px 10px -4px rgba(15,23,42,0.18)',
        }}
      >
        <p
          className="m-0 mb-1.5 text-center text-[8px] font-bold uppercase tracking-[0.18em]"
          style={{ color: '#9CA3AF', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
        >
          Cuaderno · Cadete A
        </p>
        <ol className="m-0 list-none p-0">
          {ENTRIES.map((entry, idx) => {
            const isHighlight = entry.num === 7;
            const isLast = idx === ENTRIES.length - 1;
            return (
              <li
                key={entry.num}
                className={`flex items-end gap-1 py-0.5${isHighlight ? ' ds-notebook-row-highlight' : ''}`}
                style={{
                  borderBottom: isLast ? 'none' : `1px solid ${tokens.ash100}`,
                  background: isHighlight ? 'rgba(249,115,22,0.10)' : 'transparent',
                  borderRadius: isHighlight ? 3 : 0,
                  paddingLeft: isHighlight ? 4 : 0,
                  paddingRight: isHighlight ? 4 : 0,
                }}
              >
                <span className="w-3 shrink-0 text-[8px]" style={{ color: tokens.ink400 }}>
                  {entry.num}.
                </span>
                <span
                  className="shrink-0 text-[9px]"
                  style={{
                    color: isHighlight ? tokens.courtOrangeDeep : tokens.ink900,
                    fontWeight: isHighlight ? 600 : 400,
                  }}
                >
                  {entry.title}
                </span>
                <span
                  aria-hidden="true"
                  className="mx-1 mb-1 flex-1"
                  style={{ borderBottom: `1px dotted ${tokens.ash200}` }}
                />
                <span
                  className={`text-[9px]${isHighlight ? ' ds-notebook-arrow' : ''}`}
                  style={{
                    color: isHighlight ? tokens.courtOrangeDeep : tokens.ink400,
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  }}
                  aria-hidden="true"
                >
                  →
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
