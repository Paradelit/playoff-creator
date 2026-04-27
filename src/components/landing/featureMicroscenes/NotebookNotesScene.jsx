import React from 'react';

const LINES = ['86%', '62%', '74%'];

export default function NotebookNotesScene({ reduced = false }) {
  return (
    <div
      className="fm-scene fm-notebook-scene"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-notebook"
      aria-hidden="true"
    >
      {LINES.map((width, index) => (
        <div key={width} className="fm-note-row">
          <span className="fm-note-line" style={{ '--fm-line-w': width, transitionDelay: `${index * 120}ms` }} />
          {index === LINES.length - 1 ? <span className="fm-note-tick" /> : null}
        </div>
      ))}
    </div>
  );
}
