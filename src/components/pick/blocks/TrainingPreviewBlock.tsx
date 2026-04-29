import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Dumbbell, Clock } from 'lucide-react';
import type { TrainingPreviewData } from '../../../services/contentBlocks';

type Tone = 'cyan' | 'orange' | 'green';
type Section = 'warmup' | 'main' | 'cooldown';

interface TimelineItem {
  kind: string;
  detail: string;
  duration: number;
  startMin: number;
  tone: Tone;
  section: Section;
  icon: string;
  highlight: boolean;
}

const TONE_BG: Record<Tone, string> = {
  cyan: 'rgba(26,111,212,0.08)',
  orange: 'rgba(249,115,22,0.10)',
  green: 'rgba(16,185,129,0.10)',
};

const TONE_BORDER: Record<Tone, string> = {
  cyan: 'rgba(26,111,212,0.30)',
  orange: 'rgba(249,115,22,0.32)',
  green: 'rgba(16,185,129,0.32)',
};

const TONE_LABEL: Record<Tone, string> = {
  cyan: '#1535A8',
  orange: '#C2410C',
  green: '#047857',
};

const FALLBACK_MAIN_ICONS = ['🎯', '⚡', '🏃', '💪', '🔄'];

function normalizeBlock(raw: unknown, fallbackKind: string): { kind: string; detail: string; duration: number } {
  if (typeof raw === 'string') {
    return { kind: fallbackKind, detail: raw, duration: 0 };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { title?: string; name?: string; description?: string; duration?: number };
    return {
      kind: obj.title ?? obj.name ?? fallbackKind,
      detail: obj.description ?? '',
      duration: typeof obj.duration === 'number' ? obj.duration : 0,
    };
  }
  return { kind: fallbackKind, detail: '', duration: 0 };
}

function pickIcon(kind: string, fallback: string): string {
  const lower = kind.toLowerCase();
  if (/calentamiento|warm[- ]?up|activaci/.test(lower)) return '🔥';
  if (/vuelta|cool.?down|estiramiento|estira/.test(lower)) return '🧘';
  if (/aplicaci|partido|scrim|condicionado/.test(lower)) return '🏀';
  if (/transici|contraataque|fast.?break/.test(lower)) return '🏃';
  if (/bloqueo|p[&] ?r|pick.?roll|directo/.test(lower)) return '⚡';
  if (/tiro|t[eé]cnica|catch.?and.?shoot|catch.?&.?shoot/.test(lower)) return '🎯';
  if (/defensa|press|presion/.test(lower)) return '🛡️';
  if (/rebote/.test(lower)) return '🤾';
  return fallback;
}

function buildTimeline(training: TrainingPreviewData): TimelineItem[] {
  const items: TimelineItem[] = [];

  if (training.warmup) {
    const b = normalizeBlock(training.warmup, 'Calentamiento');
    items.push({
      ...b,
      tone: 'cyan',
      section: 'warmup',
      icon: pickIcon(b.kind, '🔥'),
      highlight: false,
      startMin: 0,
    });
  }

  if (Array.isArray(training.mainBlocks)) {
    training.mainBlocks.forEach((raw, index) => {
      const b = normalizeBlock(raw, `Bloque ${index + 1}`);
      items.push({
        ...b,
        tone: 'orange',
        section: 'main',
        icon: pickIcon(b.kind, FALLBACK_MAIN_ICONS[index % FALLBACK_MAIN_ICONS.length]),
        highlight: index === 0,
        startMin: 0,
      });
    });
  }

  if (training.cooldown) {
    const b = normalizeBlock(training.cooldown, 'Vuelta a la calma');
    items.push({
      ...b,
      tone: 'green',
      section: 'cooldown',
      icon: pickIcon(b.kind, '🧘'),
      highlight: false,
      startMin: 0,
    });
  }

  let elapsed = 0;
  return items.map((item) => {
    const start = elapsed;
    elapsed += item.duration;
    return { ...item, startMin: start };
  });
}

function formatTime(minutes: number): string {
  return `${String(Math.max(0, Math.floor(minutes))).padStart(2, '0')}'`;
}

export default function TrainingPreviewBlock({ training }: { training: TrainingPreviewData }) {
  const items = buildTimeline(training);
  const hasData = items.length > 0;
  const hasDurations = items.some((item) => item.duration > 0);

  return (
    <section
      aria-label={`Vista previa de entrenamiento: ${training.title}`}
      className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_4px_12px_-4px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <span
          aria-hidden="true"
          className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px]"
          style={{ background: 'rgba(249,115,22,0.12)' }}
        >
          <Dumbbell size={11} className="text-orange-600" />
        </span>
        <p className="m-0 flex-1 truncate text-[12px] font-bold text-slate-900">{training.title}</p>
        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
          <Clock size={10} aria-hidden="true" />
          {training.totalDuration}'
        </span>
        {hasData ? (
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {items.length} bloques
          </span>
        ) : null}
      </div>

      {hasData ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-3">
          {items.map((item, index) => (
            <li
              key={`${item.section}-${index}`}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
              style={{
                background: item.highlight ? TONE_BG[item.tone] : '#F8FAFC',
                border: `1px solid ${item.highlight ? TONE_BORDER[item.tone] : '#F1F5F9'}`,
              }}
            >
              <span aria-hidden="true" className="shrink-0 text-[15px] leading-none">
                {item.icon}
              </span>
              {hasDurations ? (
                <span className="w-7 shrink-0 font-mono text-[10px] font-bold text-slate-500">
                  {formatTime(item.startMin)}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[12.5px] font-semibold"
                  style={{ color: item.highlight ? TONE_LABEL[item.tone] : '#0F172A' }}
                >
                  {item.kind}
                </span>
                {item.detail ? (
                  <span className="mt-0.5 block truncate text-[11.5px] text-slate-500">{item.detail}</span>
                ) : null}
              </span>
              {item.duration > 0 ? (
                <span className="shrink-0 font-mono text-[10px] font-bold text-slate-600">{item.duration}'</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-3 py-3 text-xs text-slate-500">Sin detalle de bloques.</div>
      )}

      {training.notes ? (
        <div className="px-3 pb-3 text-[11px] italic text-slate-500">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p>{children}</p>,
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
            }}
          >
            {training.notes}
          </ReactMarkdown>
        </div>
      ) : null}
    </section>
  );
}
