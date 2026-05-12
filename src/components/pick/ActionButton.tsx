import React from 'react';
import { ArrowRight, Plus } from 'lucide-react';

interface Props {
  action: { type: string; label: string; path?: string };
  onExecute: () => void;
}

export default function ActionButton({ action, onExecute }: Props) {
  const Icon = action.type === 'navigate' ? ArrowRight : Plus;

  return (
    <button
      onClick={onExecute}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 active:bg-blue-200 transition-colors"
    >
      {action.label}
      <Icon size={12} aria-hidden="true" />
    </button>
  );
}
