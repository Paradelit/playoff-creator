import React, { useId, useState, useMemo } from 'react';
import { X, Copy, Send, RotateCcw } from 'lucide-react';
import Dialog from '../Dialog';
import { useAuth } from '../../contexts/AuthContext';
import { useFirebase } from '../../contexts/FirebaseContext';
import { saveCalendarSession } from '../../services/calendarService';
import { savePlayoffConvocatoria } from '../../services/playoffConvocatoriasService';
import { renderConvocatoria } from '../../utils/convocatoriaTemplate';

export default function ConvocatoriaModal({ session, team, competition, onClose }) {
  const titleId = useId();
  const { user } = useAuth();
  const { db, appId } = useFirebase();

  const [notaExtra, setNotaExtra] = useState(session.notaExtra || '');
  const [horaCitaOverride, setHoraCitaOverride] = useState(session.horaCita || '');
  const [editedMessage, setEditedMessage] = useState(null);
  const [usingSnapshot, setUsingSnapshot] = useState(!!session.mensajeConvocatoria);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const rendered = useMemo(() => {
    const sessionForRender = { ...session, notaExtra, horaCita: horaCitaOverride || undefined };
    return renderConvocatoria({ session: sessionForRender, team, competition, now: new Date() });
  }, [session, team, competition, notaExtra, horaCitaOverride]);

  const messageToShow =
    usingSnapshot && session.mensajeConvocatoria
      ? (editedMessage ?? session.mensajeConvocatoria)
      : (editedMessage ?? rendered.mensaje);

  async function persistSent(finalMessage) {
    if (session.tipo === 'playoff') {
      await savePlayoffConvocatoria(
        {
          sessionId: session.id,
          bracketId: session.bracketId,
          bracketMatchId: session.bracketMatchId,
          gameIndex: session.gameIndex || 0,
          mensajeConvocatoria: finalMessage,
          convocatoriaSentAt: new Date(),
          notaExtra,
          horaCita: horaCitaOverride || null,
        },
        { uid: user.uid, db, appId },
      );
    } else {
      await saveCalendarSession(
        {
          ...session,
          mensajeConvocatoria: finalMessage,
          convocatoriaSentAt: new Date(),
          notaExtra,
          horaCita: horaCitaOverride || null,
        },
        { uid: user.uid, db, appId },
      );
    }
  }

  async function handleCopy() {
    setSubmitting(true);
    setError(null);
    try {
      await navigator.clipboard.writeText(messageToShow);
    } catch (e) {
       
      console.warn('clipboard write failed', e);
      setError('No pude copiar al portapapeles. Selecciona el texto y cópialo a mano.');
      setSubmitting(false);
      return;
    }
    try {
      await persistSent(messageToShow);
      onClose();
    } catch (e) {
       
      console.warn('persist after copy failed', e);
      setError('Copiado, pero no pude marcarla como enviada. Vuelve a intentarlo en un momento.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare() {
    setSubmitting(true);
    setError(null);
    try {
      const url = 'whatsapp://send?text=' + encodeURIComponent(messageToShow);
      let opened = false;
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ text: messageToShow });
          opened = true;
        } catch {
          // user cancelled or share unavailable: fall through to whatsapp scheme
        }
      }
      if (!opened) {
        window.location.href = url;
      }
      try {
        await persistSent(messageToShow);
        onClose();
      } catch (e) {
         
        console.warn('persist after share failed', e);
        setError('Compartido, pero no pude marcarla como enviada. Vuelve a intentarlo en un momento.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleRegenerate() {
    setUsingSnapshot(false);
    setEditedMessage(null);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[120] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-5.5rem)] sm:max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 my-auto shrink-0"
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
        <h3 id={titleId} className="text-lg font-bold text-slate-800">
          Mandar convocatoria
        </h3>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Nota extra (opcional)"
            value={notaExtra}
            onChange={(e) => {
              setNotaExtra(e.target.value);
              setEditedMessage(null);
            }}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={horaCitaOverride}
            placeholder="Cambiar hora de cita"
            onChange={(e) => {
              setHoraCitaOverride(e.target.value);
              setEditedMessage(null);
            }}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={messageToShow}
          onChange={(e) => setEditedMessage(e.target.value)}
          rows={14}
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-sans"
        />
        {usingSnapshot && (
          <button
            type="button"
            onClick={handleRegenerate}
            className="text-xs text-slate-500 hover:text-slate-700 self-start flex items-center gap-1"
          >
            <RotateCcw size={12} aria-hidden="true" /> Regenerar desde plantilla
          </button>
        )}
      </div>
      <div className="px-5 pb-5 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={submitting}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Copy size={15} aria-hidden="true" /> Copiar
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={submitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Send size={15} aria-hidden="true" /> Compartir por WhatsApp
          </button>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    </Dialog>
  );
}
