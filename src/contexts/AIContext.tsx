import { createContext, useContext, useMemo } from 'react';
import { runAgent, aiChat, submitFeedback } from '../services/aiClient';

interface AIContextValue {
  runAgent: typeof runAgent;
  aiChat: typeof aiChat;
  submitFeedback: typeof submitFeedback;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ runAgent, aiChat, submitFeedback }), []);
  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}
