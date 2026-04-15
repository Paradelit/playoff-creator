/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import { useCopilotInternal } from '../hooks/useCopilot';
import type { CopilotAPI } from '../hooks/useCopilot';

const CopilotCtx = createContext<CopilotAPI | null>(null);

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const copilot = useCopilotInternal();
  return <CopilotCtx.Provider value={copilot}>{children}</CopilotCtx.Provider>;
}

export function useCopilot(): CopilotAPI {
  const ctx = useContext(CopilotCtx);
  if (!ctx) throw new Error('useCopilot must be used within CopilotProvider');
  return ctx;
}
