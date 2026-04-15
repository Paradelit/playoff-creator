import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useScreenContext } from '../contexts/ScreenContextProvider';
import { runAgent, aiChatV2, submitFeedback } from '../services/aiClient';
import { useCopilotTips } from './useCopilotTips';
import { useConversationPersistence } from './useConversationPersistence';
import type { ChatMessage } from './useConversationPersistence';
import type { EnrichedResponsePayload } from '../services/aiClient';

export type CopilotMode = 'compact' | 'panel' | 'column';

export interface CopilotAPI {
  // Mode
  mode: CopilotMode;
  setMode: (m: CopilotMode) => void;
  isTransitioning: boolean;
  isDesktop: boolean;

  // Chat
  messages: ChatMessage[];
  isProcessing: boolean;
  sendMessage: (text: string) => Promise<void>;

  // Backward compat for existing hooks
  runAgent: typeof runAgent;
  submitFeedback: typeof submitFeedback;

  // Tips (speech bubble)
  currentTip: string | null;
  dismissTip: () => void;

  // Conversations
  conversationId: string | null;
  startNewConversation: () => void;
  conversations: Array<{ id: string; title: string; lastMessageAt: number }>;
  loadConversation: (id: string) => void;

  // Actions
  executeAction: (action: { type: string; path?: string; data?: unknown }) => void;

  // Last response for feedback
  lastTraceId: string | null;
}

export function useCopilotInternal(): CopilotAPI {
  const navigate = useNavigate();
  const location = useLocation();
  const { screenContext } = useScreenContext();

  const [mode, setModeRaw] = useState<CopilotMode>('compact');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTraceId, setLastTraceId] = useState<string | null>(null);

  const previousRouteRef = useRef(location.pathname);
  const modeBeforeTransitionRef = useRef<CopilotMode>('compact');

  const persistence = useConversationPersistence();
  const tips = useCopilotTips(screenContext);

  // Load messages from persistence
  useEffect(() => {
    if (persistence.loaded && persistence.loadedMessages.length > 0 && messages.length === 0) {
      setMessages(persistence.loadedMessages);
    }
  }, [persistence.loaded, persistence.loadedMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop media query listener
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Page transition animation
  useEffect(() => {
    if (previousRouteRef.current !== location.pathname && mode !== 'compact') {
      modeBeforeTransitionRef.current = mode;
      setIsTransitioning(true);
      setModeRaw('compact');
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        if (messages.length > 0) {
          setTimeout(() => {
            setModeRaw(isDesktop ? modeBeforeTransitionRef.current : 'panel');
          }, 400);
        }
      }, 200);
      previousRouteRef.current = location.pathname;
      return () => clearTimeout(timer);
    }
    previousRouteRef.current = location.pathname;
    return undefined;
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMode = useCallback(
    (m: CopilotMode) => {
      setModeRaw(m === 'column' && !isDesktop ? 'panel' : m);
    },
    [isDesktop],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessing) return;

      // Ensure conversation exists
      let convId = persistence.conversationId;
      if (!convId) {
        convId = await persistence.startNewConversation(text.substring(0, 60), screenContext.screen);
      }

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      // Persist user message
      persistence.saveMessage(convId, userMsg, screenContext.screen);

      try {
        const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

        const response: EnrichedResponsePayload = await aiChatV2({
          message: text,
          screenContext: {
            screen: screenContext.screen,
            route: screenContext.route,
            params: screenContext.params,
            entityType: screenContext.entityType,
            entityId: screenContext.entityId,
            data: screenContext.data,
          },
          conversationHistory: history,
        });

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.naturalResponse,
          traceId: response.traceId,
          agentUsed: response.agent,
          actions: response.actions,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLastTraceId(response.traceId);

        // Apply suggested mode (degrade column on mobile)
        if (response.suggestedMode) {
          const suggested = response.suggestedMode === 'column' && !isDesktop ? 'panel' : response.suggestedMode;
          if (suggested !== 'compact') setModeRaw(suggested);
        }

        // Persist assistant message
        persistence.saveMessage(convId, assistantMsg, screenContext.screen);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Lo siento, ha ocurrido un error al procesar tu mensaje. Inténtalo de nuevo.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        console.error('Copilot error:', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, messages, persistence, screenContext, isDesktop],
  );

  const executeAction = useCallback(
    (action: { type: string; path?: string }) => {
      if (action.type === 'navigate' && action.path) {
        navigate(action.path);
      }
    },
    [navigate],
  );

  const startNewConversation = useCallback(() => {
    setMessages([]);
    persistence.startNewConversation('Nueva conversación', screenContext.screen);
  }, [persistence, screenContext.screen]);

  const loadConversation = useCallback(
    (id: string) => {
      persistence.setConversationId(id);
      persistence.loadMessages(id).then(() => {
        setMessages(persistence.loadedMessages);
      });
    },
    [persistence],
  );

  return {
    mode,
    setMode,
    isTransitioning,
    isDesktop,
    messages,
    isProcessing,
    sendMessage,
    runAgent,
    submitFeedback,
    currentTip: tips.currentTip,
    dismissTip: tips.dismissTip,
    conversationId: persistence.conversationId,
    startNewConversation,
    conversations: persistence.conversations,
    loadConversation,
    executeAction,
    lastTraceId,
  };
}
