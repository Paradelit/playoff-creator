import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useScreenContext } from '../contexts/ScreenContextProvider';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { runAgent, aiChatV2, submitFeedback } from '../services/aiClient';
import { usePickTips, type ProactivityMode } from './usePickTips';
import { useProfile } from './useProfile';
import { useConversationPersistence } from './useConversationPersistence';
import type { ChatMessage } from './useConversationPersistence';
import type { ContentBlock, OrchestratorResponse, WriteProposal } from '../services/contentBlocks';
import { executeProposal } from '../services/proposalExecutor';

export type PickMode = 'compact' | 'panel' | 'column';

export interface PickAPI {
  // Mode
  mode: PickMode;
  setMode: (m: PickMode) => void;
  isTransitioning: boolean;
  isDesktop: boolean;

  // Chat
  messages: ChatMessage[];
  isProcessing: boolean;
  sendMessage: (text: string) => Promise<void>;
  confirmProposal: (proposal: WriteProposal) => Promise<void>;

  // Backward compat for existing hooks
  runAgent: <TResult>(
    agentName: string,
    input: Record<string, unknown>,
  ) => Promise<{ result: TResult; traceId: string }>;
  submitFeedback: typeof submitFeedback;

  // Tips (speech bubble)
  currentTip: string | null;
  dismissTip: () => void;

  // Conversations
  conversationId: string | null;
  startNewConversation: () => void;
  conversations: Array<{ id: string; title: string; lastMessageAt: number }>;
  loadConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;

  // Actions
  executeAction: (action: { type: string; path?: string; data?: unknown }) => void;

  // Last response for feedback
  lastTraceId: string | null;
}

export function usePickInternal(): PickAPI {
  const navigate = useNavigate();
  const location = useLocation();
  const { screenContext } = useScreenContext();
  const { user } = useAuth() as { user: { uid: string } | null };
  const { db, appId } = useFirebase() as { db: import('firebase/firestore').Firestore; appId: string };
  const { activeWsId } = useWorkspace() as { activeWsId: string | null };

  const [mode, setModeRaw] = useState<PickMode>('compact');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTraceId, setLastTraceId] = useState<string | null>(null);

  const previousRouteRef = useRef(location.pathname);
  const modeBeforeTransitionRef = useRef<PickMode>('compact');

  const persistence = useConversationPersistence();
  const { profile } = useProfile();
  const proactivityMode = (profile?.proactivityMode as ProactivityMode | undefined) ?? 'suggestions';
  const tips = usePickTips(screenContext, { proactivityMode });

  // Sync messages from persistence (initial load + conversation switch)
  useEffect(() => {
    if (persistence.loaded && persistence.loadedMessages.length > 0) {
      setMessages(persistence.loadedMessages);
    }
  }, [persistence.loaded, persistence.loadedMessages]);

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
    (m: PickMode) => {
      setModeRaw(m === 'column' && !isDesktop ? 'panel' : m);
    },
    [isDesktop],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessing) return;
      if (!activeWsId) {
        // No workspace active — UI should already be gated, but guard anyway.
        return;
      }

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

      if (messages.length === 0) {
        const newTitle = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        persistence.renameConversation(convId, newTitle);
      }

      try {
        const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

        const response: OrchestratorResponse = await aiChatV2({
          message: text,
          appId,
          wsId: activeWsId,
          screenContext: {
            screen: screenContext.screen,
            route: screenContext.route,
            params: screenContext.params,
            entityType: screenContext.entityType,
            entityId: screenContext.entityId,
            data: screenContext.data,
          },
          clientDate: new Date().toLocaleDateString('en-CA'), // Format as YYYY-MM-DD local
          conversationHistory: history,
          conversationId: convId,
        });

        const blocks: ContentBlock[] = response.blocks || [];
        const actions = response.actions;
        let content = blocks
          .filter((b): b is { type: 'text'; markdown: string } => b.type === 'text')
          .map((b) => b.markdown)
          .join('\n\n')
          .trim();

        if (!content) {
          const hasRichCard = blocks.some((b) =>
            [
              'team_list',
              'training_preview',
              'bracket_preview',
              'session_preview',
              'score_update',
              'exercise_preview',
              'confirm_write',
            ].includes(b.type),
          );
          if (actions && actions.length > 0) {
            content = 'He dejado un acceso directo abajo.';
          } else if (hasRichCard) {
            content = 'Ver la respuesta en las tarjetas.';
          } else {
            content = 'He terminado.';
          }
        }

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          blocks,
          ...(actions && actions.length > 0 ? { actions } : {}),
          ...(response.traceId ? { traceId: response.traceId } : {}),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLastTraceId(response.traceId);

        // Auto-expand to panel when we produce rich content
        const hasRich = blocks.some((b) => b.type !== 'text' && b.type !== 'status');
        if (hasRich && mode === 'compact') {
          setModeRaw(isDesktop ? 'panel' : 'panel');
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
        console.error('Pick error:', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, messages, persistence, screenContext, isDesktop, mode, appId, activeWsId],
  );

  const confirmProposal = useCallback(
    async (proposal: WriteProposal) => {
      if (!user) throw new Error('Debes iniciar sesión');
      if (!activeWsId) throw new Error('Workspace no disponible');
      await executeProposal({ db, appId, wsId: activeWsId }, proposal);
    },
    [db, appId, user, activeWsId],
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
      setMessages([]);
      persistence.setConversationId(id);
      persistence.loadMessages(id);
    },
    [persistence],
  );

  const runAgentBound = useCallback(
    async <TResult>(agentName: string, input: Record<string, unknown>) => {
      if (!activeWsId) throw new Error('Workspace no disponible');
      const sessionId = persistence.conversationId || crypto.randomUUID();
      return await runAgent<TResult>(agentName, input, { wsId: activeWsId, appId, sessionId });
    },
    [persistence.conversationId, activeWsId, appId],
  );

  return {
    mode,
    setMode,
    isTransitioning,
    isDesktop,
    messages,
    isProcessing,
    sendMessage,
    confirmProposal,
    runAgent: runAgentBound,
    submitFeedback,
    currentTip: tips.currentTip,
    dismissTip: tips.dismissTip,
    conversationId: persistence.conversationId,
    startNewConversation,
    conversations: persistence.conversations,
    loadConversation,
    renameConversation: persistence.renameConversation,
    executeAction,
    lastTraceId,
  };
}
