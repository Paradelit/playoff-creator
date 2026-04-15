import { useState } from 'react';
import { useAI } from '../contexts/AIContext';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface AIFeedbackProps {
  traceId: string | null;
}

export default function AIFeedback({ traceId }: AIFeedbackProps) {
  const { submitFeedback } = useAI();
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);

  if (!traceId) return null;

  const handleFeedback = async (value: number) => {
    setSubmitted(value > 0 ? 'positive' : 'negative');
    try {
      await submitFeedback(traceId, value);
    } catch {
      // silent fail — feedback is non-critical
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span>¿Te fue útil?</span>
      <button
        onClick={() => handleFeedback(1)}
        disabled={!!submitted}
        className={`p-1 rounded hover:bg-green-50 ${submitted === 'positive' ? 'text-green-600' : ''}`}
      >
        <ThumbsUp size={16} />
      </button>
      <button
        onClick={() => handleFeedback(0)}
        disabled={!!submitted}
        className={`p-1 rounded hover:bg-red-50 ${submitted === 'negative' ? 'text-red-600' : ''}`}
      >
        <ThumbsDown size={16} />
      </button>
      {submitted && <span className="text-xs text-slate-300">¡Gracias!</span>}
    </div>
  );
}
