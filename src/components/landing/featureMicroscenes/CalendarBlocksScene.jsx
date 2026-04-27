import React from 'react';

const BLOCKS = [
  { className: 'fm-calendar-block fm-calendar-block-a', style: { '--fm-bx': '18px', '--fm-by': '-10px' } },
  { className: 'fm-calendar-block fm-calendar-block-b', style: { '--fm-bx': '-14px', '--fm-by': '6px' } },
  { className: 'fm-calendar-block fm-calendar-block-c', style: { '--fm-bx': '10px', '--fm-by': '14px' } },
];

export default function CalendarBlocksScene({ reduced = false }) {
  return (
    <div
      className="fm-scene fm-calendar-scene"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-calendar"
      aria-hidden="true"
    >
      <div className="fm-calendar-grid" />
      {BLOCKS.map((block) => (
        <span key={block.className} className={block.className} style={block.style} />
      ))}
    </div>
  );
}
