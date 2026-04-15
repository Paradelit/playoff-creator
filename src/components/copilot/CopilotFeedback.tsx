import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useCopilot } from '../../contexts/CopilotProvider';

interface Props {
  traceId: string;
}

export default function CopilotFeedback({ traceId }: Props) {
  const { submitFeedback } = useCopilot();
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);

  const handleFeedback = async (value: number) => {
    setSubmitted(value > 0 ? 'positive' : 'negative');
    try {
      await submitFeedback(traceId, value);
    } catch {
      // silent fail — feedback is non-critical
    }
  };

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <button
        onClick={() => handleFeedback(1)}
        disabled={!!submitted}
        className={`p-0.5 rounded hover:bg-green-50 ${submitted === 'positive' ? 'text-green-600' : ''}`}
      >
        <ThumbsUp size={12} />
      </button>
      <button
        onClick={() => handleFeedback(0)}
        disabled={!!submitted}
        className={`p-0.5 rounded hover:bg-red-50 ${submitted === 'negative' ? 'text-red-600' : ''}`}
      >
        <ThumbsDown size={12} />
      </button>
      {submitted && <span className="text-[10px]">Gracias</span>}
    </div>
  );
}
