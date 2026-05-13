import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Maximize2, Plus, MapPin } from 'lucide-react';
import { usePick } from '../../contexts/PickProvider';
import { useScreenContext } from '../../contexts/ScreenContextProvider';
import ActionButton from './ActionButton';
import PickFeedback from './PickFeedback';
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

// Contextual prompt suggestions per screen for the empty conversation state.
// Each chip is a one-tap entry into a Pick capability — the goal is to make
// "what can Pick do" obvious without forcing the coach to invent a question.
const SUGGESTIONS: Record<string, string[]> = {
  home: ['Resume mi semana', 'Prepara el entreno de hoy', '¿Qué tengo pendiente?'],
  calendar: ['Importa el Excel de la federación', 'Crea un entreno semanal', 'Resume esta semana'],
  bracket: ['Explícame este cuadro', '¿Quién juega contra mi equipo?', 'Marca a Estudiantes como mi equipo'],
  'team-detail': [
    'Genera la convocatoria del próximo partido',
    '¿Quién falta esta semana?',
    'Crea un entreno para mañana',
  ],
  'team-trainings': ['Genera un entreno de tiro', 'Resume el último entreno', 'Sugiéreme un calentamiento'],
  'training-editor': ['Sugiéreme un calentamiento', 'Añade un ejercicio de tiro', 'Resume este entreno'],
  cuaderno: ['Resume las notas del último entreno', '¿Qué jugadores faltaron?', 'Repaso de pilares'],
  teams: ['Resume mis equipos', 'Compara plantillas', 'Sugiéreme un entreno común'],
  exercises: ['Sugiéreme un ejercicio de bote', 'Crea variante de este ejercicio', '¿Qué he usado más?'],
  scouting: ['Prepara scouting del rival', 'Resume jugadas clave', 'Compara con partido anterior'],
  analysis: ['Resume cómo fue el partido', '¿Qué funcionó?', 'Plan para el próximo entreno'],
  settings: ['¿Qué puede hacer Pick?', 'Cuéntame de proactividad', '¿Cómo cambio recordatorios?'],
};

const FALLBACK_SUGGESTIONS = ['Resume mi semana', 'Prepara el entreno de hoy', '¿Qué tengo pendiente?'];

export default function PickPanel() {
  const {
    messages,
    isProcessing,
    sendMessage,
    setMode,
    isDesktop,
    executeAction,
    confirmProposal,
    startNewConversation,
  } = usePick();
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
    <div className="fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-32px)] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col animate-pick-panel-open print:hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-800 text-sm">Pick</h3>
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
          <div className="py-6">
            <div className="text-center mb-4">
              <div
                className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center shadow-sm"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
                aria-hidden="true"
              >
                <span className="text-white font-extrabold text-base leading-none">P</span>
              </div>
              <p className="font-semibold text-slate-700 text-sm">¡Hola! Soy Pick.</p>
              <p className="mt-0.5 text-xs text-slate-500">Prueba con una de estas:</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {(SUGGESTIONS[screenContext.screen] || FALLBACK_SUGGESTIONS).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="text-left text-sm text-slate-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1"
                >
                  {suggestion}
                </button>
              ))}
            </div>
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
                  <BlockRenderer
                    blocks={msg.blocks!}
                    onConfirmProposal={confirmProposal}
                    onPickChoice={(c, intent) => sendMessage(`${intent} → ${c.label}`)}
                  />
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
            <div
              aria-label="Pick está pensando"
              className="bg-slate-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 inline-flex items-center gap-1"
            >
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"
                style={{ animation: 'pc-dot 1.2s infinite 0s' }}
              />
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"
                style={{ animation: 'pc-dot 1.2s infinite 0.16s' }}
              />
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400"
                style={{ animation: 'pc-dot 1.2s infinite 0.32s' }}
              />
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
