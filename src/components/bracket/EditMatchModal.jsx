import React, { useState } from 'react';
import { parseDateToISO } from '../../utils/calendarUtils';

function toBracketDate(iso) {
  if (!iso) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const norm = parseDateToISO(iso);
  if (!norm) return '';
  const [y, m, d] = norm.split('-');
  return `${d}/${m}/${y}`;
}

function buildInitial(arr, len, fill = '') {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < len) out.push(fill);
  if (out.length > len) out.length = len;
  return out;
}

export default function EditMatchModal({ match, onClose, onSave }) {
  const [title, setTitle] = useState(match.title || '');
  const [gamesCount, setGamesCount] = useState(match.gamesCount || 1);
  const size = Number(gamesCount) || match.gamesCount || 1;

  const [dates, setDates] = useState(() =>
    buildInitial(
      (match.dates || []).map((d) => parseDateToISO(d) || ''),
      size,
    ),
  );
  const [times, setTimes] = useState(() => buildInitial(match.times, size));
  const [endTimes, setEndTimes] = useState(() => buildInitial(match.endTimes, size));
  const [places, setPlaces] = useState(() => buildInitial(match.places, size));

  React.useEffect(() => {
    setDates((prev) => buildInitial(prev, size));
    setTimes((prev) => buildInitial(prev, size));
    setEndTimes((prev) => buildInitial(prev, size));
    setPlaces((prev) => buildInitial(prev, size));
  }, [size]);

  const handleSave = () => {
    const parsed = parseInt(gamesCount);
    onSave(title, parsed, {
      dates: dates.map((d) => toBracketDate(d)),
      times,
      endTimes,
      places,
    });
  };

  const updateAt = (setter) => (idx, value) => {
    setter((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-slate-800">Editar Partido</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Título de la Ronda</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Final, Partido 3..."
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Formato</label>
            <select
              value={gamesCount}
              onChange={(e) => setGamesCount(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value={1}>Partido único (Mejor de 1)</option>
              <option value={2}>Ida y Vuelta (Sumatorio de 2)</option>
              <option value={3}>Al mejor de 3</option>
            </select>
          </div>

          <div className="pt-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Horarios y lugar</label>
            <div className="space-y-3">
              {Array.from({ length: size }).map((_, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    {size > 1 ? `Partido ${i + 1}` : 'Partido'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="date"
                      value={dates[i] || ''}
                      onChange={(e) => updateAt(setDates)(i, e.target.value)}
                      className="col-span-1 sm:col-span-1 p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="time"
                      value={times[i] || ''}
                      onChange={(e) => updateAt(setTimes)(i, e.target.value)}
                      className="p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Inicio"
                    />
                    <input
                      type="time"
                      value={endTimes[i] || ''}
                      onChange={(e) => updateAt(setEndTimes)(i, e.target.value)}
                      className="p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Fin"
                    />
                  </div>
                  <input
                    type="text"
                    value={places[i] || ''}
                    onChange={(e) => updateAt(setPlaces)(i, e.target.value)}
                    placeholder="Lugar..."
                    className="mt-2 w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
