import React from 'react';
import { useCopilot } from '../../contexts/CopilotProvider';
import CopilotCompact from './CopilotCompact';
import CopilotPanel from './CopilotPanel';
import CopilotColumn from './CopilotColumn';

export default function CopilotRoot() {
  const { mode, isTransitioning, isDesktop } = useCopilot();

  if (isTransitioning) return <CopilotCompact animating />;

  const effectiveMode = mode === 'column' && !isDesktop ? 'panel' : mode;

  switch (effectiveMode) {
    case 'compact':
      return <CopilotCompact />;
    case 'panel':
      return <CopilotPanel />;
    case 'column':
      return <CopilotColumn />;
    default:
      return <CopilotCompact />;
  }
}
