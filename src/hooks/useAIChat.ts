import { useState } from 'react';
import { useAI } from '../contexts/AIContext';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  traceId?: string;
  agentUsed?: string;
}

export function useAIChat() {
  const { aiChat, submitFeedback } = useAI();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  async function sendMessage(userMessage: string, context?: Record<string, unknown>) {
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', content: userMessage };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    try {
      const result = await aiChat(userMessage, context);
      const assistantMsg: ChatMessage = {
        id: Date.now(),
        role: 'assistant',
        content:
          result.type === 'no_match'
            ? (result.message as string) || 'No pude procesar tu solicitud.'
            : JSON.stringify(result.result, null, 2),
        traceId: result.traceId,
        agentUsed: result.type === 'agent_result' ? result.agent : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      return result;
    } finally {
      setIsProcessing(false);
    }
  }

  return { messages, isProcessing, sendMessage, submitFeedback };
}
