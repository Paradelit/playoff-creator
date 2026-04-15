import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { useAIChat } from '../hooks/useAIChat';
import AIFeedback from './AIFeedback';

export default function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, isProcessing, sendMessage } = useAIChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-50 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-colors"
          aria-label="Abrir chat IA"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 h-[28rem] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-blue-600 rounded-t-xl">
            <div className="flex items-center gap-2 text-white">
              <Bot size={20} />
              <span className="font-semibold text-sm">Asistente IA</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-slate-400 mt-8">
                Pregúntame sobre brackets, calendarios o resultados.
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot size={14} className="text-blue-600" />
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="mt-1 flex items-center gap-2">
                      {msg.agentUsed && (
                        <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                          {msg.agentUsed}
                        </span>
                      )}
                      <AIFeedback traceId={msg.traceId || null} />
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                    <User size={14} className="text-slate-600" />
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="flex gap-2 items-center text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Pensando...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-slate-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje..."
                disabled={isProcessing}
                className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
