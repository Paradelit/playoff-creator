import React from 'react';
import { Undo, Trash2, X } from 'lucide-react';
import CourtCanvas, { COURT_TOOLS } from '../CourtCanvas';

export default function PlaybookEditorModal({ ejercicio, activeTool, setActiveTool, updateEjercicio, onClose }) {
  const TOOLS = COURT_TOOLS;

  return (
    <div className="fixed inset-0 z-[110] bg-gray-900/90 flex flex-col items-center justify-center p-4 touch-none print:hidden">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header modal */}
        <div className="flex flex-wrap justify-between items-center gap-2 p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <h3 className="font-bold text-gray-800">Playbook Editor</h3>
            <div className="flex gap-1">
              <button
                onClick={() => updateEjercicio(ejercicio.id, 'elementos', (ejercicio.elementos || []).slice(0, -1))}
                className="p-1.5 text-gray-600 hover:bg-gray-200 rounded flex items-center text-sm"
                title="Deshacer último"
              >
                <Undo size={14} className="mr-1" /> <span className="hidden sm:inline">Deshacer</span>
              </button>
              <button
                onClick={() => updateEjercicio(ejercicio.id, 'elementos', [])}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded flex items-center text-sm"
                title="Limpiar pizarra"
              >
                <Trash2 size={14} className="mr-1" /> <span className="hidden sm:inline">Limpiar</span>
              </button>
              <div className="flex gap-1 border-l border-gray-300 pl-2 ml-1">
                {[
                  ['media', 'Media'],
                  ['entera', 'Entera'],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => updateEjercicio(ejercicio.id, 'tipoPista', val)}
                    className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-semibold transition-colors ${ejercicio.tipoPista === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden bg-gray-100">
          {/* Toolbar móvil */}
          <div className="flex sm:hidden flex-wrap gap-1 p-2 bg-white border-b border-gray-200 overflow-x-auto">
            {TOOLS.filter((t) => !t.divider).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${activeTool === t.id ? 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
              >
                <div className="w-5 flex justify-center shrink-0">{t.icon}</div>
                <span className="leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
          {/* Sidebar herramientas (desktop) */}
          <div className="hidden sm:flex w-48 bg-white border-r border-gray-200 flex-col p-2 gap-1 overflow-y-auto">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mt-2 mb-1">Herramientas</p>
            {TOOLS.map((t, idx) =>
              t.divider ? (
                <div key={idx} className="h-px bg-gray-200 my-1 mx-2" />
              ) : (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${activeTool === t.id ? 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
                >
                  <div className="w-6 flex justify-center shrink-0">{t.icon}</div>
                  <span className="text-xs leading-tight">{t.label}</span>
                </button>
              ),
            )}
            <div className="mt-auto p-3 bg-blue-50 rounded text-xs text-blue-800 leading-relaxed border border-blue-100 mx-1">
              <b>Tip:</b> Objetos: clic para colocar. Líneas: clic y arrastra.
            </div>
          </div>

          {/* Lienzo */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-6 select-none">
            <div className="bg-white shadow border border-gray-300 w-full flex items-center justify-center">
              <CourtCanvas
                tipo={ejercicio.tipoPista}
                elementos={ejercicio.elementos || []}
                setElementos={(nuevos) => updateEjercicio(ejercicio.id, 'elementos', nuevos)}
                readOnly={false}
                activeTool={activeTool}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
