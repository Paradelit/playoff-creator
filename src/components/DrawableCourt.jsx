import React, { useRef, useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

const COLORS = ['#000000', '#e53e3e', '#3182ce'];
const COLOR_LABELS = ['Negro', 'Rojo', 'Azul'];

// SVG media pista de baloncesto
function HalfCourtSVG() {
  return (
    <>
      {/* Fondo */}
      <rect x="0" y="0" width="280" height="210" fill="#f5deb3" stroke="none" />
      {/* Línea de fondo */}
      <line x1="0" y1="0" x2="280" y2="0" stroke="#8B6914" strokeWidth="2" />
      {/* Líneas laterales */}
      <line x1="0" y1="0" x2="0" y2="210" stroke="#8B6914" strokeWidth="2" />
      <line x1="280" y1="0" x2="280" y2="210" stroke="#8B6914" strokeWidth="2" />
      {/* Línea de medio campo */}
      <line x1="0" y1="210" x2="280" y2="210" stroke="#8B6914" strokeWidth="2" />
      {/* Zona pintada (rectángulo) */}
      <rect x="90" y="0" width="100" height="110" fill="none" stroke="#8B6914" strokeWidth="2" />
      {/* Zona restringida (semicírculo pequeño bajo el aro) */}
      <path d="M 120,0 A 20,20 0 0,0 160,0" fill="none" stroke="#8B6914" strokeWidth="1.5" />
      {/* Línea de tiro libre */}
      <line x1="90" y1="110" x2="190" y2="110" stroke="#8B6914" strokeWidth="2" />
      {/* Semicírculo tiro libre */}
      <path d="M 90,110 A 50,50 0 0,0 190,110" fill="none" stroke="#8B6914" strokeWidth="2" />
      {/* Aro */}
      <circle cx="140" cy="18" r="8" fill="none" stroke="#8B6914" strokeWidth="2" />
      {/* Tablero */}
      <rect x="115" y="2" width="50" height="8" fill="none" stroke="#8B6914" strokeWidth="1.5" />
      {/* Línea de triple (arco) */}
      <path d="M 20,0 A 122,122 0 0,0 260,0" fill="none" stroke="#8B6914" strokeWidth="2" />
      {/* Líneas laterales triple */}
      <line x1="20" y1="0" x2="20" y2="35" stroke="#8B6914" strokeWidth="2" />
      <line x1="260" y1="0" x2="260" y2="35" stroke="#8B6914" strokeWidth="2" />
      {/* Círculo central (medio campo) */}
      <circle cx="140" cy="210" r="30" fill="none" stroke="#8B6914" strokeWidth="2" />
    </>
  );
}

// SVG pista entera
function FullCourtSVG() {
  return (
    <>
      <rect x="0" y="0" width="280" height="420" fill="#f5deb3" />
      {/* Borde */}
      <rect x="0" y="0" width="280" height="420" fill="none" stroke="#8B6914" strokeWidth="2" />
      {/* Línea de medio campo */}
      <line x1="0" y1="210" x2="280" y2="210" stroke="#8B6914" strokeWidth="2" />
      {/* Círculo central */}
      <circle cx="140" cy="210" r="30" fill="none" stroke="#8B6914" strokeWidth="2" />
      {/* Zona pintada arriba */}
      <rect x="90" y="0" width="100" height="110" fill="none" stroke="#8B6914" strokeWidth="2" />
      <path d="M 120,0 A 20,20 0 0,0 160,0" fill="none" stroke="#8B6914" strokeWidth="1.5" />
      <line x1="90" y1="110" x2="190" y2="110" stroke="#8B6914" strokeWidth="2" />
      <path d="M 90,110 A 50,50 0 0,0 190,110" fill="none" stroke="#8B6914" strokeWidth="2" />
      <circle cx="140" cy="18" r="8" fill="none" stroke="#8B6914" strokeWidth="2" />
      <rect x="115" y="2" width="50" height="8" fill="none" stroke="#8B6914" strokeWidth="1.5" />
      <path d="M 20,0 A 122,122 0 0,0 260,0" fill="none" stroke="#8B6914" strokeWidth="2" />
      <line x1="20" y1="0" x2="20" y2="35" stroke="#8B6914" strokeWidth="2" />
      <line x1="260" y1="0" x2="260" y2="35" stroke="#8B6914" strokeWidth="2" />
      {/* Zona pintada abajo */}
      <rect x="90" y="310" width="100" height="110" fill="none" stroke="#8B6914" strokeWidth="2" />
      <path d="M 120,420 A 20,20 0 0,1 160,420" fill="none" stroke="#8B6914" strokeWidth="1.5" />
      <line x1="90" y1="310" x2="190" y2="310" stroke="#8B6914" strokeWidth="2" />
      <path d="M 90,310 A 50,50 0 0,1 190,310" fill="none" stroke="#8B6914" strokeWidth="2" />
      <circle cx="140" cy="402" r="8" fill="none" stroke="#8B6914" strokeWidth="2" />
      <rect x="115" y="410" width="50" height="8" fill="none" stroke="#8B6914" strokeWidth="1.5" />
      <path d="M 20,420 A 122,122 0 0,1 260,420" fill="none" stroke="#8B6914" strokeWidth="2" />
      <line x1="20" y1="385" x2="20" y2="420" stroke="#8B6914" strokeWidth="2" />
      <line x1="260" y1="385" x2="260" y2="420" stroke="#8B6914" strokeWidth="2" />
    </>
  );
}

const DrawableCourt = React.memo(function DrawableCourt({ tipo = 'media', trazos = [], setTrazos }) {
  const svgRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const currentStroke = useRef([]);

  const isFullCourt = tipo === 'entera';
  const viewBox = isFullCourt ? '0 0 280 420' : '0 0 280 210';

  function getSVGPoint(e) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    return `${svgP.x.toFixed(1)},${svgP.y.toFixed(1)}`;
  }

  const startDraw = useCallback(
    (e) => {
      if (!setTrazos) return;
      e.preventDefault();
      setDrawing(true);
      const pt = getSVGPoint(e);
      if (pt) currentStroke.current = [pt];
    },
    [setTrazos],
  );

  const moveDraw = useCallback(
    (e) => {
      if (!drawing || !setTrazos) return;
      e.preventDefault();
      const pt = getSVGPoint(e);
      if (pt) currentStroke.current = [...currentStroke.current, pt];
      // Force re-render to show current stroke preview
      setTrazos((prev) => prev); // no-op to trigger re-render trick — we rely on drawing state
    },
    [drawing, setTrazos],
  );

  const endDraw = useCallback(
    (e) => {
      if (!drawing || !setTrazos) return;
      e.preventDefault();
      setDrawing(false);
      if (currentStroke.current.length > 1) {
        setTrazos((prev) => [...prev, { points: currentStroke.current, color }]);
      }
      currentStroke.current = [];
    },
    [drawing, color, setTrazos],
  );

  const pointsToPolyline = (pts) => pts.join(' ');

  return (
    <div className="flex flex-col gap-2">
      {setTrazos && (
        <div className="flex items-center gap-3 print:hidden">
          <div className="flex gap-1.5">
            {COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                title={COLOR_LABELS[i]}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? 'border-slate-700 scale-110' : 'border-slate-300'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTrazos([])}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            <Trash2 size={13} /> Borrar
          </button>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={`w-full border border-slate-300 rounded-lg ${setTrazos ? 'cursor-crosshair touch-none' : ''}`}
        style={{ userSelect: 'none' }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      >
        {isFullCourt ? <FullCourtSVG /> : <HalfCourtSVG />}

        {/* Trazos guardados */}
        {trazos.map((stroke, i) => (
          <polyline
            key={i}
            points={pointsToPolyline(stroke.points)}
            fill="none"
            stroke={stroke.color || '#000000'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Trazo en curso — ref read in render is intentional for live preview */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {drawing && currentStroke.current.length > 1 && (
          <polyline
            // eslint-disable-next-line react-hooks/refs
            points={pointsToPolyline(currentStroke.current)}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
});

export default DrawableCourt;
