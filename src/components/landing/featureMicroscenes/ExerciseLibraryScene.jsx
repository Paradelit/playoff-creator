import React from 'react';

export default function ExerciseLibraryScene({ reduced = false }) {
  return (
    <div
      className="fm-scene fm-library-scene"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-library"
      aria-hidden="true"
    >
      <span className="fm-library-card fm-library-card-a" />
      <span className="fm-library-card fm-library-card-b" />
      <span className="fm-library-card fm-library-card-c" />
    </div>
  );
}
