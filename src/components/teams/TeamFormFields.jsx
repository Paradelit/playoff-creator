import React from 'react';
import { CATEGORIAS, ANOS, LETRAS_RAPIDAS, GENEROS, YEAR_KEY, DEFAULT_YEAR } from './teamFormConstants';

export function TeamFormFields({ form, setForm }) {
  const esSenior = form.categoria === 'Senior';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categoría</label>
          <select
            value={form.categoria}
            onChange={(e) =>
              setForm((f) => ({ ...f, categoria: e.target.value, division: '', [YEAR_KEY]: DEFAULT_YEAR }))
            }
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            {CATEGORIAS.map((categoria) => (
              <option key={categoria}>{categoria}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Género</label>
          <select
            value={form.genero}
            onChange={(e) => setForm((f) => ({ ...f, genero: e.target.value }))}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            {GENEROS.map((genero) => (
              <option key={genero}>{genero}</option>
            ))}
          </select>
        </div>
      </div>

      {esSenior && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            División <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={form.division || ''}
            onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))}
            placeholder="Nacional, Sub22, Autonómica..."
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}

      {!esSenior && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Año</label>
          <div className="flex gap-2">
            {ANOS.map((ano) => (
              <button
                key={ano}
                type="button"
                onClick={() => setForm((f) => ({ ...f, [YEAR_KEY]: ano }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  form[YEAR_KEY] === ano ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {ano}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Letra</label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {LETRAS_RAPIDAS.map((letra) => (
              <button
                key={letra}
                type="button"
                onClick={() => setForm((f) => ({ ...f, letra }))}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                  form.letra === letra ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {letra}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={form.letra || ''}
            onChange={(e) => setForm((f) => ({ ...f, letra: e.target.value.toUpperCase() }))}
            placeholder="F..."
            maxLength={4}
            className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>
    </div>
  );
}
