import React, { useState } from 'react';
import { Send, Copy, Check } from 'lucide-react';
import type { ConvocatoriaPreviewData } from '../../../services/contentBlocks';
import { useAuth } from '../../../contexts/AuthContext';
import { useFirebase } from '../../../contexts/FirebaseContext';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { saveCalendarSession } from '../../../services/calendarService';
import { savePlayoffConvocatoria } from '../../../services/playoffConvocatoriasService';

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatFecha(fecha?: string) {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-').map(Number);
  if (!y || !m || !d) return fecha;
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export default function ConvocatoriaBlock({ convocatoria }: { convocatoria: ConvocatoriaPreviewData }) {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { activeWsId } = useWorkspace() as { activeWsId: string | null };
  const [text, setText] = useState(convocatoria.mensaje);
  const [submitting, setSubmitting] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPlayoff = convocatoria.tipo === 'playoff';

  async function persist(finalMessage: string) {
    if (!user || !activeWsId) return;
    if (isPlayoff) {
      if (!convocatoria.bracketId || !convocatoria.bracketMatchId || convocatoria.gameIndex == null) return;
      await savePlayoffConvocatoria(
        {
          sessionId: convocatoria.sessionId,
          bracketId: convocatoria.bracketId,
          bracketMatchId: convocatoria.bracketMatchId,
          gameIndex: convocatoria.gameIndex,
          mensajeConvocatoria: finalMessage,
          convocatoriaSentAt: new Date(),
        },
        { wsId: activeWsId, db, appId },
      );
    } else {
      await saveCalendarSession(
        {
          id: convocatoria.sessionId,
          mensajeConvocatoria: finalMessage,
          convocatoriaSentAt: new Date(),
        },
        { wsId: activeWsId, db, appId },
      );
    }
  }

  async function handleCopy() {
    setSubmitting(true);
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      try {
        await persist(text);
        setPersisted(true);
      } catch (e) {
        setError('Copiado, pero no pude marcarla como enviada. Inténtalo desde el calendario.');

        console.warn('persist after copy failed', e);
      }
    } catch (e) {
      setError('No pude copiar al portapapeles.');

      console.warn('clipboard write failed', e);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    setSubmitting(true);
    setError(null);
    try {
      const url = 'whatsapp://send?text=' + encodeURIComponent(text);
      let opened = false;
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ text });
          opened = true;
        } catch {
          // user cancelled or share unavailable: fall through to whatsapp scheme
        }
      }
      if (!opened) {
        window.location.href = url;
      }
      try {
        await persist(text);
        setPersisted(true);
      } catch (e) {
        setError('Compartido, pero no pude marcarla como enviada. Inténtalo desde el calendario.');

        console.warn('persist after share failed', e);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const subtitleParts = [
    convocatoria.rival ? `vs ${convocatoria.rival}` : null,
    formatFecha(convocatoria.fecha),
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 my-2 shadow-sm">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Convocatoria</p>
          {subtitleParts.length > 0 && (
            <p className="text-sm font-semibold text-slate-800 truncate">{subtitleParts.join(' · ')}</p>
          )}
        </div>
        {persisted && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <Check size={12} aria-hidden="true" /> Enviada
          </span>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        aria-label="Mensaje de la convocatoria"
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={submitting}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          <Copy size={14} aria-hidden="true" /> Copiar
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={submitting}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        >
          <Send size={14} aria-hidden="true" /> WhatsApp
        </button>
      </div>
      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
    </div>
  );
}
