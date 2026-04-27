import React, { useEffect, useRef, useState } from 'react';

/**
 * PlayoffScrollTelling
 *
 * A sticky scroll-driven scene that plays a 3-act story:
 *   Act 1 (0-33%):  A PDF document sits on screen, glowing
 *   Act 2 (33-66%): The PDF "explodes" — particles fly outward
 *   Act 3 (66-100%): Data particles re-land and assemble into a bracket
 *
 * Implementation: a sticky inner div reads scrollY to derive progress 0-1,
 * then drives CSS transforms and opacity purely in JS — no framer-motion needed.
 */

const STYLES = `
  @keyframes pt-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes pt-pulse  { 0%,100%{opacity:.6} 50%{opacity:1} }
  @keyframes pt-glow   { 0%,100%{box-shadow:0 0 24px 4px rgba(249,115,22,.2)} 50%{box-shadow:0 0 48px 12px rgba(249,115,22,.5)} }
  @keyframes pt-land   { from{opacity:0;transform:scale(.4) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
  .pt-pdf-idle { animation: pt-float 3s ease-in-out infinite, pt-glow 3s ease-in-out infinite; }
  .pt-bracket-cell { animation: pt-land .4s ease forwards; }
`;

/* Bracket data: 8-team single-elim */
const BRACKET = {
  qf: [
    { a: 'Calasanz',   b: 'Joventut'  },
    { a: 'Juventud',   b: 'Estudiantes', bye: true },
    { a: 'Baskonia',   b: 'Unicaja'   },
    { a: 'Real Madrid',b: 'Barcelona', bo: 'BO3' },
  ],
  sf: [
    { a: '?', b: '?' },
    { a: '?', b: '?' },
  ],
  final: { a: '?', b: '?' },
};

/* Flying particles (the "exploding PDF data") */
const PARTICLES = [
  { label: 'Calasanz',    x: -55, y: -70 },
  { label: 'Joventut',   x:  55, y: -80 },
  { label: 'Baskonia',   x: -80, y: -10 },
  { label: 'Unicaja',    x:  80, y: -20 },
  { label: 'Juventud',   x: -65, y:  50 },
  { label: 'Estudiantes',x:  65, y:  60 },
  { label: 'Barcelona',  x: -45, y:  80 },
  { label: 'Real Madrid',x:  45, y:  90 },
  { label: 'BO3',        x:  90, y:  30, accent: true },
  { label: 'BYE',        x: -90, y:  20, accent: true },
  { label: '8 equipos',  x:   0, y: -95, accent: true },
  { label: 'R1 · R2 · Final', x: 0, y: 95, accent: true },
];

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function BracketDisplay({ visible }) {
  return (
    <div
      className="w-full max-w-lg mx-auto"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity .3s ease' }}
      aria-label="Cuadro de playoffs generado"
    >
      {/* QF + SF + Final laid out in columns */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 justify-center">
        <span>Cuartos</span>
        <span className="flex-1 h-px bg-slate-700" />
        <span>Semis</span>
        <span className="flex-1 h-px bg-slate-700" />
        <span>Final</span>
      </div>
      <div className="flex items-stretch gap-2">
        {/* QF */}
        <div className="flex-1 flex flex-col justify-around gap-2">
          {BRACKET.qf.map((m, i) => (
            <div
              key={i}
              className="pt-bracket-cell rounded-lg overflow-hidden text-xs"
              style={{
                animationDelay: i * 120 + 'ms',
                opacity: 0,
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.1)',
              }}
            >
              <div className="px-2.5 py-1.5 border-b border-white/10 flex justify-between items-center">
                <span className="text-slate-200 font-medium truncate">{m.a}</span>
                {m.bo && (
                  <span className="ml-1 shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(249,115,22,.2)', color: '#f97316' }}>
                    {m.bo}
                  </span>
                )}
              </div>
              <div className="px-2.5 py-1.5 flex justify-between items-center">
                <span className="text-slate-200 font-medium truncate">{m.b}</span>
                {m.bye && (
                  <span className="ml-1 shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(16,185,129,.15)', color: '#34d399' }}>
                    BYE
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Connector lines QF→SF */}
        <div className="w-4 flex flex-col justify-around" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="flex-1 flex flex-col justify-around">
              <div className="h-1/4" />
              <div className="flex-1 border-r border-slate-600" />
              <div className="h-1/4" />
            </div>
          ))}
        </div>

        {/* SF */}
        <div className="flex-1 flex flex-col justify-around gap-6">
          {BRACKET.sf.map((m, i) => (
            <div
              key={i}
              className="pt-bracket-cell rounded-lg overflow-hidden text-xs"
              style={{
                animationDelay: (4 + i) * 120 + 'ms',
                opacity: 0,
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.1)',
              }}
            >
              <div className="px-2.5 py-1.5 border-b border-white/10 text-slate-400">Ganador QF {i * 2 + 1}</div>
              <div className="px-2.5 py-1.5 text-slate-400">Ganador QF {i * 2 + 2}</div>
            </div>
          ))}
        </div>

        {/* Connector lines SF→Final */}
        <div className="w-4 flex flex-col justify-around" aria-hidden="true">
          <div className="flex-1 flex flex-col justify-around">
            <div className="h-1/4" />
            <div className="flex-1 border-r border-orange-500/40" />
            <div className="h-1/4" />
          </div>
        </div>

        {/* Final */}
        <div className="flex-1 flex flex-col justify-center">
          <div
            className="pt-bracket-cell rounded-lg overflow-hidden text-xs"
            style={{
              animationDelay: '720ms',
              opacity: 0,
              background: 'rgba(249,115,22,.08)',
              border: '1px solid rgba(249,115,22,.3)',
            }}
          >
            <div className="px-2.5 py-2 border-b text-orange-300 font-semibold" style={{ borderColor: 'rgba(249,115,22,.2)' }}>
              Ganador SF 1
            </div>
            <div className="px-2.5 py-2 text-orange-300 font-semibold">Ganador SF 2</div>
            <div className="px-2.5 py-1 text-center text-[10px] font-bold text-orange-400"
              style={{ background: 'rgba(249,115,22,.1)' }}>
              FINAL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayoffScrollTelling() {
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);
  const [progress, setProgress] = useState(0); // 0-1

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section) return;
      const { top, height } = section.getBoundingClientRect();
      const scrollable = height - window.innerHeight;
      if (scrollable <= 0) return;
      const p = Math.max(0, Math.min(1, -top / scrollable));
      setProgress(p);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Derived animation values */
  const act1 = Math.min(1, progress / 0.33);           // 0 → 1 during first third
  const act2 = Math.max(0, Math.min(1, (progress - 0.33) / 0.33)); // 0 → 1 during middle third
  const act3 = Math.max(0, Math.min(1, (progress - 0.66) / 0.34)); // 0 → 1 during last third

  const pdfOpacity     = lerp(1, 0, easeOut(act2));
  const pdfScale       = lerp(1, 0.4, easeOut(act2));
  const particleSpread = easeInOut(act2);
  const bracketVisible = act3 > 0.3;

  return (
    <>
      <style>{STYLES}</style>

      {/* tall scroll container — 3x viewport = scroll space */}
      <section
        ref={sectionRef}
        className="relative"
        style={{ height: '300vh', background: 'linear-gradient(180deg,#0a0a18 0%,#06060f 100%)' }}
      >
        {/* Sticky scene */}
        <div
          ref={stickyRef}
          className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden px-6"
        >
          {/* Section label */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 text-center">
            <p className="text-xs font-bold tracking-widest text-orange-400 uppercase mb-2">Playoffs con IA</p>
            <h2
              className="text-3xl lg:text-4xl font-extrabold text-white"
              style={{ opacity: lerp(0, 1, easeOut(act1 * 3)), transform: 'translateY(' + lerp(20, 0, easeOut(act1 * 3)) + 'px)' }}
            >
              Un PDF. Un cuadro perfecto.
            </h2>
          </div>

          {/* Stage */}
          <div className="relative w-full max-w-2xl flex items-center justify-center" style={{ minHeight: 320 }}>

            {/* ── Act 1: PDF icon ── */}
            <div
              className={pdfOpacity > 0.05 ? 'pt-pdf-idle' : ''}
              style={{
                opacity: pdfOpacity,
                transform: 'scale(' + pdfScale + ')',
                transition: 'none',
                position: 'absolute',
              }}
            >
              {/* PDF card */}
              <div
                className="w-52 rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
                style={{
                  background: 'linear-gradient(145deg,#1a1a30,#14142a)',
                  border: '1px solid rgba(249,115,22,.4)',
                }}
              >
                {/* PDF icon */}
                <div
                  className="w-16 h-20 rounded-xl flex items-end justify-center pb-2 relative"
                  style={{ background: 'linear-gradient(145deg,#ef4444,#dc2626)' }}
                >
                  <span className="text-white text-xs font-black">PDF</span>
                  {/* dog-ear */}
                  <div
                    className="absolute top-0 right-0 w-5 h-5"
                    style={{
                      background: 'rgba(0,0,0,.3)',
                      clipPath: 'polygon(100% 0,100% 100%,0 100%)',
                    }}
                  />
                </div>
                <div className="text-white font-semibold text-sm leading-tight">Bases_Competicion.pdf</div>
                <div className="text-slate-400 text-xs">8 equipos · BO3 Final · BYE automático</div>
              </div>
            </div>

            {/* ── Act 2: Flying particles ── */}
            {PARTICLES.map((p, i) => {
              const angle = Math.atan2(p.y, p.x);
              const tx = particleSpread * p.x * 2.2;
              const ty = particleSpread * p.y * 1.8;
              const opacity = particleSpread * (1 - act3 * 2);
              return (
                <div
                  key={i}
                  className="absolute text-xs font-semibold px-2 py-1 rounded-lg pointer-events-none"
                  style={{
                    opacity: Math.max(0, opacity),
                    transform: 'translate(' + tx + 'px,' + ty + 'px) rotate(' + (angle * 30) + 'deg)',
                    background: p.accent ? 'rgba(249,115,22,.15)' : 'rgba(255,255,255,.06)',
                    border: p.accent ? '1px solid rgba(249,115,22,.3)' : '1px solid rgba(255,255,255,.1)',
                    color: p.accent ? '#f97316' : '#cbd5e1',
                    whiteSpace: 'nowrap',
                  }}
                  aria-hidden="true"
                >
                  {p.label}
                </div>
              );
            })}

            {/* ── Act 3: Bracket assembles ── */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                opacity: act3,
                transform: 'scale(' + lerp(0.85, 1, easeOut(act3)) + ')',
                pointerEvents: bracketVisible ? 'auto' : 'none',
              }}
            >
              <BracketDisplay visible={bracketVisible} />
            </div>
          </div>

          {/* Progress hint */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: i === Math.floor(progress * 2.99) ? 24 : 8,
                    background: i === Math.floor(progress * 2.99) ? '#f97316' : 'rgba(255,255,255,.2)',
                  }}
                />
              ))}
            </div>
            {act3 < 0.1 && (
              <p className="text-slate-500 text-xs animate-bounce mt-1">Sigue bajando</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
