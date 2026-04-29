import React from 'react';
import { MapPin } from 'lucide-react';
import { tokens, gradients } from '../../../design/tokens';

/**
 * Mini-replica of the real PickPanel: header chrome (Pick label + MapPin chip),
 * user bubble in Score-Clock Cyan with bottom-right corner sharp, Pick avatar +
 * assistant bubble in slate-100 with bottom-left corner sharp. Three slate-400
 * thinking dots animate with the canonical pc-dot keyframe.
 */
export default function PickChatScene({ reduced = false }) {
  const dotAnim = (delay) => (reduced ? 'none' : `pc-dot 1.2s infinite ${delay}`);

  return (
    <div className="fm-scene" data-reduced={reduced ? 'true' : 'false'} data-testid="scene-pick" aria-hidden="true">
      <div className="flex items-center justify-between gap-1.5 border-b pb-1.5" style={{ borderColor: tokens.ash100 }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-extrabold leading-none" style={{ color: tokens.ink900 }}>
            Pick
          </span>
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] leading-none"
            style={{ background: tokens.ash50, color: tokens.ink500 }}
          >
            <MapPin size={8} aria-hidden="true" />
            Entrenos
          </span>
        </div>
        <span className="flex gap-0.5">
          <span className="h-1 w-1 rounded-full" style={{ background: tokens.ink400 }} />
          <span className="h-1 w-1 rounded-full" style={{ background: tokens.ink400 }} />
          <span className="h-1 w-1 rounded-full" style={{ background: tokens.ink400 }} />
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <div className="flex justify-end">
          <span
            className="max-w-[80%] truncate px-2 py-1 text-[10px] font-medium leading-tight text-white transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:scale-[1.02]"
            style={{
              background: tokens.scoreClockBlue,
              borderRadius: '8px 8px 2px 8px',
            }}
          >
            Pick, entreno mañana 60 min
          </span>
        </div>

        <div className="flex items-end gap-1.5">
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-extrabold leading-none text-white transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-110"
            style={{ background: gradients.pickAvatar }}
          >
            P
          </span>
          <span
            className="relative inline-flex items-center gap-1 px-2 py-1.5"
            style={{
              background: tokens.ash100,
              borderRadius: '8px 8px 8px 2px',
            }}
          >
            <span
              aria-hidden="true"
              className="h-1 w-1 rounded-full transition-colors group-hover:bg-orange-500"
              style={{ background: tokens.ink400, animation: dotAnim('0s') }}
            />
            <span
              aria-hidden="true"
              className="h-1 w-1 rounded-full transition-colors group-hover:bg-orange-500"
              style={{ background: tokens.ink400, animation: dotAnim('0.16s') }}
            />
            <span
              aria-hidden="true"
              className="h-1 w-1 rounded-full transition-colors group-hover:bg-orange-500"
              style={{ background: tokens.ink400, animation: dotAnim('0.32s') }}
            />
          </span>
          <span
            aria-hidden="true"
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white opacity-0 transition-all duration-300 group-hover:opacity-100"
            style={{ background: tokens.successGreen }}
          >
            ✓
          </span>
        </div>
      </div>
    </div>
  );
}
