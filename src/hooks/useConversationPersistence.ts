import { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { ContentBlock } from '../services/contentBlocks';
import { deleteConversationCascade } from '../services/dataCleanupService';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blocks?: ContentBlock[];
  traceId?: string;
  agentUsed?: string;
  actions?: Array<{ type: string; label: string; path?: string; data?: unknown }>;
  timestamp: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessageAt: number;
  messageCount: number;
  lastScreen: string;
}

const MAX_MESSAGES = 30;
const MAX_CONVERSATIONS = 15;

interface AuthUser {
  uid: string;
}

interface AuthContextValue {
  user: AuthUser | null;
}

interface FirebaseContextValue {
  db: Firestore | null;
  appId: string;
}

export function useConversationPersistence() {
  const { user } = useAuth() as AuthContextValue;
  const { db, appId } = useFirebase() as FirebaseContextValue;
  const { activeWsId } = useWorkspace() as { activeWsId: string | null };
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadedMessages, setLoadedMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);

  const conversationsRef = useCallback(() => {
    if (!db || !user || !activeWsId) return null;
    return collection(db, 'artifacts', appId, 'users', user.uid, 'pickHistory', activeWsId, 'conversations');
  }, [db, user, appId, activeWsId]);

  const messagesRef = useCallback(
    (convId: string) => {
      if (!db || !user || !activeWsId) return null;
      return collection(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'pickHistory',
        activeWsId,
        'conversations',
        convId,
        'messages',
      );
    },
    [db, user, appId, activeWsId],
  );

  const loadMessages = useCallback(
    async (convId: string) => {
      const ref = messagesRef(convId);
      if (!ref) return;
      const snap = await getDocs(query(ref, orderBy('timestamp', 'asc'), limit(MAX_MESSAGES)));
      const msgs: ChatMessage[] = [];
      snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as ChatMessage));
      setLoadedMessages(msgs);
    },
    [messagesRef],
  );

  // Load conversations on mount
  useEffect(() => {
    if (!db || !user) return undefined;
    const ref = conversationsRef();
    if (!ref) return undefined;
    getDocs(query(ref, orderBy('lastMessageAt', 'desc'), limit(MAX_CONVERSATIONS)))
      .then((snap) => {
        const convs: ConversationSummary[] = [];
        snap.forEach((d) => convs.push({ id: d.id, ...d.data() } as ConversationSummary));
        setConversations(convs);
        // Load latest if < 24h old
        if (convs.length > 0 && Date.now() - convs[0].lastMessageAt < 24 * 60 * 60 * 1000) {
          setConversationId(convs[0].id);
          loadMessages(convs[0].id);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return undefined;
  }, [db, user, conversationsRef, loadMessages]);

  const saveMessage = useCallback(
    async (convId: string, message: ChatMessage, screen: string) => {
      const ref = messagesRef(convId);
      const convRef = conversationsRef();
      if (!ref || !convRef) return;

      const messageData = { ...message, timestamp: message.timestamp } as Record<string, any>;
      Object.keys(messageData).forEach((key) => {
        if (messageData[key] === undefined) {
          delete messageData[key];
        }
      });

      await setDoc(doc(ref, message.id), messageData);
      await setDoc(
        doc(convRef, convId),
        {
          lastMessageAt: message.timestamp,
          messageCount: (loadedMessages.length || 0) + 1,
          lastScreen: screen,
        },
        { merge: true },
      );
    },
    [messagesRef, conversationsRef, loadedMessages.length],
  );

  const startNewConversation = useCallback(
    async (title: string, screen: string): Promise<string> => {
      const id = crypto.randomUUID();
      const convRef = conversationsRef();
      if (!convRef) return id;
      await setDoc(doc(convRef, id), {
        id,
        title: title.substring(0, 60),
        lastMessageAt: Date.now(),
        messageCount: 0,
        lastScreen: screen,
      });
      setConversationId(id);
      setLoadedMessages([]);
      // Enforce max conversations limit
      if (conversations.length >= MAX_CONVERSATIONS) {
        const oldest = conversations[conversations.length - 1];
        await deleteConversationCascade({ appId, conversationId: oldest.id });
      }
      return id;
    },
    [appId, conversationsRef, conversations],
  );

  const renameConversation = useCallback(
    async (id: string, newTitle: string) => {
      const convRef = conversationsRef();
      if (!convRef) return;
      await setDoc(doc(convRef, id), { title: newTitle }, { merge: true });
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
    },
    [conversationsRef],
  );

  return {
    conversationId,
    setConversationId,
    conversations,
    loadedMessages,
    loaded,
    saveMessage,
    startNewConversation,
    loadMessages,
    renameConversation,
  };
}
