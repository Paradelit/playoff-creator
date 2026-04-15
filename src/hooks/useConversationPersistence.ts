import { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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

export function useConversationPersistence() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadedMessages, setLoadedMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);

  const conversationsRef = useCallback(() => {
    if (!db || !user) return null;
    return collection(db, 'artifacts', appId, 'users', user.uid, 'conversations');
  }, [db, user, appId]);

  const messagesRef = useCallback(
    (convId: string) => {
      if (!db || !user) return null;
      return collection(db, 'artifacts', appId, 'users', user.uid, 'conversations', convId, 'messages');
    },
    [db, user, appId],
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
    if (!db || !user) return;
    const ref = conversationsRef();
    if (!ref) return;
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
  }, [db, user, conversationsRef, loadMessages]);

  const saveMessage = useCallback(
    async (convId: string, message: ChatMessage, screen: string) => {
      const ref = messagesRef(convId);
      const convRef = conversationsRef();
      if (!ref || !convRef) return;
      await setDoc(doc(ref, message.id), { ...message, timestamp: message.timestamp });
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
        await deleteDoc(doc(convRef, oldest.id));
      }
      return id;
    },
    [conversationsRef, conversations],
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
  };
}
