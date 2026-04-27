import React from 'react';
import { MessageCircle, Plus } from 'lucide-react';

interface Props {
  conversations: Array<{ id: string; title: string; lastMessageAt: number }>;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export default function ConversationList({ conversations, activeId, onSelect, onNew }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl px-3 py-2.5 transition"
        >
          <Plus size={16} /> Nueva conversación
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">Sin conversaciones</p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition border-b border-slate-50 ${
                activeId === conv.id ? 'bg-blue-50' : ''
              }`}
            >
              <MessageCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{conv.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{timeAgo(conv.lastMessageAt)}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
