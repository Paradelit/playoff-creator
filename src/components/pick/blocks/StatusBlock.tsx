import React from 'react';
import { Loader2 } from 'lucide-react';

export default function StatusBlock({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-500 italic">
      <Loader2 size={11} className="animate-spin" />
      <span>{text}</span>
    </div>
  );
}
