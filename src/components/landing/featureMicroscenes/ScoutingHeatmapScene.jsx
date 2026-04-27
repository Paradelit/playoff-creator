import React from 'react';

const HEAT_CELLS = Array.from({ length: 20 }, (_, index) => ({
  key: index,
  delay: `${index * 40}ms`,
}));

export default function ScoutingHeatmapScene({ reduced = false }) {
  return (
    <div
      className="fm-scene fm-heatmap-scene"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-scouting"
      aria-hidden="true"
    >
      {HEAT_CELLS.map((cell) => (
        <span key={cell.key} className="fm-heat-cell" style={{ animationDelay: cell.delay }} />
      ))}
    </div>
  );
}
