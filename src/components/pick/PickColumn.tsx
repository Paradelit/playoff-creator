import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Minimize2, Loader2, MapPin } from 'lucide-react';
import { usePick } from '../../contexts/PickProvider';
import { useScreenContext } from '../../contexts/ScreenContextProvider';
import ActionButton from './ActionButton';
import PickFeedback from './PickFeedback';
import ConversationList from './ConversationList';
import BlockRenderer from './blocks/BlockRenderer';
import TextBlock from './blocks/TextBlock';

const SCREEN_LABELS: Record<string, string> = {
  home: 'Inicio',
  calendar: 'Calendario',
  bracket: 'Torneos',
  'team-detail': 'Equipo',
  'team-trainings': 'Entrenamientos',
  'training-editor': 'Entrenamiento',
  cuaderno: 'Cuaderno',
  teams: 'Equipos',
  exercises: 'Ejercicios',
  settings: 'Ajustes',
  scouting: 'Scouting',
  analysis: 'Análisis',
};

export default function PickColumn() {
  const {
    messages,
    isProcessing,
    sendMessage,
    setMode,
    executeAction,
    confirmProposal,
    startNewConversation,
    conversations,
    conversationId,
    loadConversation,
  } = usePick();
  const { screenContext } = useScreenContext();
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'chat' | 'conversations'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    document.body.style.marginRight = '400px';
    return () => {
      document.body.style.marginRight = '';
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const screenLabel = SCREEN_LABELS[screenContext.screen] || screenContext.screen;

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[400px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col overflow-hidden animate-pick-panel-open print:hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-800 text-sm">Pick</h3>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
            <MapPin size={10} /> {screenLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('panel')}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Comprimir"
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={() => setMode('compact')}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 text-sm font-semibold py-2.5 transition ${
            tab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setTab('conversations')}
          className={`flex-1 text-sm font-semibold py-2.5 transition ${
            tab === 'conversations' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Conversaciones
        </button>
      </div>

      {tab === 'conversations' ? (
        <ConversationList
          conversations={conversations}
          activeId={conversationId}
          onSelect={(id) => {
            loadConversation(id);
            setTab('chat');
          }}
          onNew={() => {
            startNewConversation();
            setTab('chat');
          }}
        />
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-12">
                <p className="font-medium">¡Hola! Soy Pick.</p>
                <p className="mt-1 text-xs">Pregúntame lo que necesites sobre la app.</p>
              </div>
            )}
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const hasBlocks = !isUser && msg.blocks && msg.blocks.length > 0;
              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed bg-blue-600 text-white">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[85%] space-y-2">
                    {hasBlocks ? (
                      <BlockRenderer blocks={msg.blocks!} onConfirmProposal={confirmProposal} />
                    ) : (
                      <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-slate-100 text-slate-800">
                        <TextBlock markdown={msg.content} />
                      </div>
                    )}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.actions.map((action, i) => (
                          <ActionButton key={i} action={action} onExecute={() => executeAction(action)} />
                        ))}
                      </div>
                    )}
                    {msg.traceId && (
                      <div>
                        <PickFeedback traceId={msg.traceId} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  <Loader2 size={16} className="text-slate-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-2.5 border-t border-slate-200">
            <div className="flex items-end gap-2 bg-slate-50 rounded-xl px-3 py-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Pregunta sobre ${screenLabel}...`}
                disabled={isProcessing}
                rows={1}
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none resize-none max-h-24"
              />
              <button
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="p-1.5 text-blue-600 hover:text-blue-700 disabled:text-slate-300 transition shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
