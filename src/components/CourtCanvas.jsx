import React, { useRef, useState } from 'react';

// ─── SVG markers ─────────────────────────────────────────────────────────────

export const SvgDefs = () => (
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8" fill="none" stroke="black" strokeWidth="1.5" />
    </marker>
    <marker id="screenBar" markerWidth="8" markerHeight="12" refX="4" refY="6" orient="auto">
      <line x1="4" y1="0" x2="4" y2="12" stroke="black" strokeWidth="2" />
    </marker>
  </defs>
);

// ─── Zig-zag path (dribble) ──────────────────────────────────────────────────

export const getZigZagPath = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return `M ${x1},${y1}`;
  const numSteps = Math.max(2, Math.floor(dist / 6));
  const stepX = dx / numSteps;
  const stepY = dy / numSteps;
  const nx = -dy / dist;
  const ny = dx / dist;
  const amp = 3;
  let path = `M ${x1},${y1}`;
  for (let i = 1; i < numSteps; i++) {
    const cx = x1 + stepX * i;
    const cy = y1 + stepY * i;
    const dir = i % 2 === 0 ? 1 : -1;
    path += ` L ${cx + nx * amp * dir},${cy + ny * amp * dir}`;
  }
  path += ` L ${x2},${y2}`;
  return path;
};

// ─── Single element renderer ─────────────────────────────────────────────────

export const RenderElement = ({ el }) => {
  if (el.type === 'O') {
    return (
      <g>
        <circle cx={el.x} cy={el.y} r="5.5" fill="white" stroke="black" strokeWidth="1.2" />
        <text x={el.x} y={el.y + 3} textAnchor="middle" fontSize="9" fontWeight="bold" fill="black" className="select-none pointer-events-none">{el.num}</text>
      </g>
    );
  }
  if (el.type === 'X') {
    return (
      <path d={`M ${el.x - 4.5} ${el.y - 4.5} L ${el.x + 4.5} ${el.y + 4.5} M ${el.x - 4.5} ${el.y + 4.5} L ${el.x + 4.5} ${el.y - 4.5}`} stroke="black" strokeWidth="1.5" />
    );
  }
  if (el.type === 'ball') {
    return <circle cx={el.x} cy={el.y} r="3.5" fill="#f97316" stroke="black" strokeWidth="1" />;
  }
  if (el.type === 'cone') {
    return <path d={`M ${el.x} ${el.y - 4} L ${el.x + 4} ${el.y + 4} L ${el.x - 4} ${el.y + 4} Z`} fill="#ef4444" stroke="black" strokeWidth="1" />;
  }
  if (el.type === 'line') {
    if (el.lineType === 'move')
      return <path d={`M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`} stroke="black" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />;
    if (el.lineType === 'pass')
      return <path d={`M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`} stroke="black" strokeWidth="1.5" fill="none" strokeDasharray="4,3" markerEnd="url(#arrow)" />;
    if (el.lineType === 'dribble')
      return <path d={getZigZagPath(el.x1, el.y1, el.x2, el.y2)} stroke="black" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />;
    if (el.lineType === 'screen')
      return <path d={`M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`} stroke="black" strokeWidth="1.5" fill="none" markerEnd="url(#screenBar)" />;
  }
  return null;
};

// ─── Court background lines ───────────────────────────────────────────────────

const MediaPista = () => (
  <>
    <rect x="5" y="5" width="140" height="130" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M55 5 L55 50 L95 50 L95 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M55 50 A 20 20 0 0 0 95 50" strokeDasharray="4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M55 50 A 20 20 0 0 1 95 50" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M15 5 L15 35 A 60 60 0 0 0 135 35 L135 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <line x1="65" y1="12" x2="85" y2="12" stroke="currentColor" strokeWidth="2" />
    <circle cx="75" cy="18" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </>
);

const PistaEntera = () => (
  <>
    <rect x="5" y="5" width="270" height="130" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <line x1="140" y1="5" x2="140" y2="135" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="140" cy="70" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 45 L45 45 L45 95 L5 95" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M45 50 A 20 20 0 0 1 45 90" strokeDasharray="4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M45 50 A 20 20 0 0 0 45 90" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 15 L35 15 A 55 55 0 0 1 35 125 L5 125" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <line x1="12" y1="60" x2="12" y2="80" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="70" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M275 45 L235 45 L235 95 L275 95" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M235 50 A 20 20 0 0 0 235 90" strokeDasharray="4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M235 50 A 20 20 0 0 1 235 90" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M275 15 L245 15 A 55 55 0 0 0 245 125 L275 125" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <line x1="268" y1="60" x2="268" y2="80" stroke="currentColor" strokeWidth="2" />
    <circle cx="262" cy="70" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </>
);

// ─── CourtCanvas ──────────────────────────────────────────────────────────────

export default function CourtCanvas({ tipo, elementos = [], setElementos, readOnly = false, activeTool }) {
  const svgRef = useRef(null);
  const [dragStart, setDragStart] = useState(null);
  const [previewEnd, setPreviewEnd] = useState(null);

  const getCoords = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const CTM = svg.getScreenCTM();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - CTM.e) / CTM.a, y: (clientY - CTM.f) / CTM.d };
  };

  const handleDown = (e) => {
    if (readOnly) return;
    e.preventDefault();
    const coords = getCoords(e);
    if (['O', 'X', 'ball', 'cone'].includes(activeTool)) {
      const nextNum = (elementos.filter(el => el.type === 'O').length % 5) + 1;
      setElementos([...elementos, { id: Date.now(), type: activeTool, x: coords.x, y: coords.y, num: activeTool === 'O' ? nextNum : null }]);
      return;
    }
    if (['move', 'pass', 'dribble', 'screen'].includes(activeTool)) {
      setDragStart(coords);
      setPreviewEnd(coords);
    }
  };

  const handleMove = (e) => {
    if (readOnly || !dragStart) return;
    e.preventDefault();
    setPreviewEnd(getCoords(e));
  };

  const handleUp = () => {
    if (readOnly || !dragStart) return;
    const dist = Math.hypot(previewEnd.x - dragStart.x, previewEnd.y - dragStart.y);
    if (dist > 5) {
      setElementos([...elementos, {
        id: Date.now(), type: 'line', lineType: activeTool,
        x1: dragStart.x, y1: dragStart.y, x2: previewEnd.x, y2: previewEnd.y,
      }]);
    }
    setDragStart(null);
    setPreviewEnd(null);
  };

  const viewBox = tipo === 'media' ? '0 0 150 140' : '0 0 280 140';

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className={`w-full h-full text-black ${readOnly ? '' : 'cursor-crosshair touch-none'}`}
      onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
      onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp}
      style={{ touchAction: 'none' }}
    >
      <SvgDefs />
      <g className="opacity-70 pointer-events-none">
        {tipo === 'media' ? <MediaPista /> : <PistaEntera />}
      </g>
      {elementos.map(el => <RenderElement key={el.id} el={el} />)}
      {dragStart && previewEnd && (
        <RenderElement el={{ type: 'line', lineType: activeTool, x1: dragStart.x, y1: dragStart.y, x2: previewEnd.x, y2: previewEnd.y }} />
      )}
    </svg>
  );
}

// ─── Playbook Editor (modal reutilizable) ─────────────────────────────────────

export const COURT_TOOLS = [
  { id: 'O',       label: 'Atacante (Auto 1-5)', icon: <div className="w-4 h-4 rounded-full border border-black text-[10px] flex items-center justify-center font-bold">1</div> },
  { id: 'X',       label: 'Defensor',            icon: <span className="font-bold text-sm">X</span> },
  { id: 'ball',    label: 'Balón',               icon: <div className="w-3 h-3 rounded-full bg-orange-500 border border-black" /> },
  { id: 'cone',    label: 'Cono',                icon: <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-l-transparent border-r-transparent border-b-red-500" /> },
  { divider: true },
  { id: 'move',    label: 'Corte (Sólida)',      icon: <svg width="20" height="10"><line x1="2" y1="5" x2="18" y2="5" stroke="black" strokeWidth="1.5" markerEnd="url(#arrow)" /></svg> },
  { id: 'pass',    label: 'Pase (Discontinua)',  icon: <svg width="20" height="10"><line x1="2" y1="5" x2="18" y2="5" stroke="black" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#arrow)" /></svg> },
  { id: 'dribble', label: 'Bote (ZigZag)',       icon: <svg width="20" height="10"><path d="M2,5 L6,2 L10,8 L14,2 L18,5" stroke="black" fill="none" strokeWidth="1.5" /></svg> },
  { id: 'screen',  label: 'Bloqueo (Tope)',      icon: <svg width="20" height="10"><path d="M2,5 L16,5 M16,2 L16,8" stroke="black" strokeWidth="1.5" /></svg> },
];
