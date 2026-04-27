import React from 'react';

export default function PickChatScene({ reduced = false }) {
  return (
    <div
      className="fm-scene fm-pick-scene"
      data-reduced={reduced ? 'true' : 'false'}
      data-testid="scene-pick"
      aria-hidden="true"
    >
      <div className="fm-pick-bubble fm-pick-bubble-user" />
      <div className="fm-pick-bubble fm-pick-bubble-assistant" />
      <div className="fm-pick-typing">
        <span className="fm-pick-dot" />
        <span className="fm-pick-dot" />
        <span className="fm-pick-dot" />
      </div>
    </div>
  );
}
