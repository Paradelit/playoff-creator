import React from 'react';
import { ChevronLeft, ZoomOut, ZoomIn, CheckCircle } from 'lucide-react';
import BracketNode from '../components/BracketNode';

export default function PreviewScreen({
  pendingBracket, setPendingBracket,
  previewZoom, setPreviewZoom,
  handleConfirmBracket, setAppMode,
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-blue-900 text-white px-4 py-3 shadow-md flex items-center justify-between gap-3 z-10 relative">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => { setAppMode('upload'); setPendingBracket(null); }} className="p-2 bg-blue-800 rounded-lg shrink-0"><ChevronLeft size={20} /></button>
          <div className="min-w-0 flex flex-col gap-0.5">
            <input
              className="text-base lg:text-xl font-bold bg-transparent border-b border-blue-500 focus:outline-none focus:border-white text-white truncate w-full"
              value={pendingBracket.name}
              onChange={e => setPendingBracket(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del cuadro"
            />
            <input
              className="text-blue-200 text-xs font-semibold uppercase bg-transparent border-b border-blue-700 focus:outline-none focus:border-blue-300 truncate w-full"
              value={pendingBracket.tournamentNameDetected || ''}
              onChange={e => setPendingBracket(prev => ({ ...prev, tournamentNameDetected: e.target.value }))}
              placeholder="Nombre del torneo"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-blue-800 rounded-lg border border-blue-700">
            <button onClick={() => setPreviewZoom(z => Math.max(0.3, z - 0.1))} className="p-2"><ZoomOut size={18} /></button>
            <div className="px-3 py-2 text-sm border-x border-blue-700 w-16 text-center">{Math.round(previewZoom * 100)}%</div>
            <button onClick={() => setPreviewZoom(z => Math.min(1.5, z + 0.1))} className="p-2"><ZoomIn size={18} /></button>
          </div>
          <button onClick={() => { setAppMode('upload'); setPendingBracket(null); }} className="px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-bold rounded-lg">Descartar</button>
          <button onClick={handleConfirmBracket} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-lg flex items-center gap-2"><CheckCircle size={16} /> Confirmar y guardar</button>
        </div>
      </header>
      <div className="flex-1 overflow-auto bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] p-4">
        <div className="absolute min-w-max p-12 w-full flex justify-center pb-32" style={{ transform: `scale(${previewZoom})`, transformOrigin: 'top center' }}>
          <BracketNode nodeId={pendingBracket.bracketData.rootId} bracketData={pendingBracket.bracketData} onScoreChange={() => {}} onSelectSorteo={() => {}} myTeam="" readOnly={true} />
        </div>
      </div>
    </div>
  );
}
