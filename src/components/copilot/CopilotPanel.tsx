import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Maximize2, Plus, Loader2, MapPin } from 'lucide-react';
import { useCopilot } from '../../contexts/CopilotProvider';
import { useScreenContext } from '../../contexts/ScreenContextProvider';
import ActionButton from './ActionButton';
import CopilotFeedback from './CopilotFeedback';

const SCREEN_LABELS: Record<string, string> = {
  home: 'Inicio',
  calendar: 'Calendario',
  bracket: 'Playoffs',
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

export default function CopilotPanel() {
  const { messages, isProcessing, sendMessage, setMode, isDesktop, executeAction, startNewConversation } = useCopilot();
  const { screenContext } = useScreenContext();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const screenLabel = SCREEN_LABELS[screenContext.screen] || screenContext.screen;
  const placeholder = screenContext.screen === 'unknown' ? 'Escribe tu mensaje...' : `Pregunta sobre ${screenLabel}...`;

  return (
    <div className="fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-32px)] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col animate-copilot-panel-open">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-800 text-sm">Copilot</h3>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
            <MapPin size={10} /> {screenLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startNewConversation}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Nueva conversación"
          >
            <Plus size={16} />
          </button>
          {isDesktop && (
            <button
              onClick={() => setMode('column')}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              title="Expandir"
            >
              <Maximize2 size={16} />
            </button>
          )}
          <button
            onClick={() => setMode('compact')}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-8">
            <p className="font-medium">¡Hola! Soy tu copilot.</p>
            <p className="mt-1 text-xs">Pregúntame lo que necesites sobre la app.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-slate-100 text-slate-800 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {msg.actions.map((action, i) => (
                    <ActionButton key={i} action={action} onExecute={() => executeAction(action)} />
                  ))}
                </div>
              )}
              {msg.role === 'assistant' && msg.traceId && (
                <div className="mt-2">
                  <CopilotFeedback traceId={msg.traceId} />
                </div>
              )}
            </div>
          </div>
        ))}
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
      <form onSubmit={handleSubmit} className="px-3 py-2.5 border-t border-slate-100">
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isProcessing}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="p-1.5 text-blue-600 hover:text-blue-700 disabled:text-slate-300 transition"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
