import React, { useState } from 'react';
import {
  Trophy,
  ChevronLeft,
  FileText,
  UploadCloud,
  CheckCircle,
  MessageSquare,
  Loader2,
  ArrowRight,
  ShieldHalf,
  Bot,
  PencilRuler,
  Upload,
} from 'lucide-react';
import { useBracket } from '../contexts/BracketContext';

export default function UploadScreen({ pendingTeamName }) {
  const {
    newBracketName,
    setNewBracketName,
    basesFile,
    setBasesFile,
    clasifFile,
    setClasifFile,
    customPrompt,
    setCustomPrompt,
    isProcessing,
    processStatus,
    errorMsg,
    setErrorMsg,
    fileInputBases,
    fileInputClasif,
    handleProcessDocuments,
    handleCreateManualBracket,
    manualTeamCount,
    setManualTeamCount,
    manualFormat,
    setManualFormat,
    setAppMode,
    fileInputImport,
    handleImport,
  } = useBracket();

  const [creationTab, setCreationTab] = useState('manual'); // 'manual' | 'import' | 'ia'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-blue-900 p-8 text-center text-white relative">
          <button
            onClick={() => setAppMode('dashboard')}
            className="absolute left-6 top-8 text-blue-200 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ChevronLeft size={20} /> Volver
          </button>
          <Trophy size={48} className="mx-auto mb-4 text-amber-400" />
          <h1 className="text-3xl font-bold tracking-wide">Crear Torneo</h1>

          <div className="flex bg-blue-800 rounded-lg p-1 mt-6 max-w-xl mx-auto">
            <button
              onClick={() => setCreationTab('manual')}
              className={`flex-1 py-2 px-3 text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${creationTab === 'manual' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-200 hover:text-white'}`}
            >
              <PencilRuler size={16} /> Desde Cero
            </button>
            <button
              onClick={() => setCreationTab('import')}
              className={`flex-1 py-2 px-3 text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${creationTab === 'import' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-200 hover:text-white'}`}
            >
              <Upload size={16} /> Importar
            </button>
            <button
              onClick={() => setCreationTab('ia')}
              className={`flex-1 py-2 px-3 text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${creationTab === 'ia' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-200 hover:text-white'}`}
            >
              <Bot size={16} /> Con IA
            </button>
          </div>
        </div>

        <div className="p-8">
          {pendingTeamName && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-700 font-semibold mb-6">
              <ShieldHalf size={15} />
              Torneo para: <span className="font-bold">{pendingTeamName}</span>
            </div>
          )}

          {creationTab !== 'import' && (
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Torneo</label>
              <input
                type="text"
                value={newBracketName}
                onChange={(e) => {
                  setNewBracketName(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Ej. Benjamín Masculino 2º Año"
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {creationTab === 'ia' && (
            <>
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${basesFile ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`}
                  onClick={() => !isProcessing && fileInputBases.current?.click()}
                >
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputBases}
                    accept=".pdf"
                    onChange={(e) => setBasesFile(e.target.files[0])}
                  />
                  {basesFile ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle size={32} className="text-indigo-600" />{' '}
                      <span className="text-xs mt-1 truncate w-full px-2">{basesFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-500">
                      <FileText size={32} /> <span className="font-medium">1. Subir Bases</span>
                    </div>
                  )}
                </div>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${clasifFile ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`}
                  onClick={() => !isProcessing && fileInputClasif.current?.click()}
                >
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputClasif}
                    accept=".pdf"
                    onChange={(e) => setClasifFile(e.target.files[0])}
                  />
                  {clasifFile ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle size={32} className="text-indigo-600" />{' '}
                      <span className="text-xs mt-1 truncate w-full px-2">{clasifFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-500">
                      <UploadCloud size={32} /> <span className="font-medium">2. Subir Clasificación</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-2">
                <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <MessageSquare size={16} className="text-slate-500" />
                  Contexto Adicional (Opcional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Puedes darle pistas a la IA: 'Presta mucha atención al orden matemático de los cruces de Benjamín', 'Prioriza a UROS DE RIVAS', etc..."
                  disabled={isProcessing}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none h-20 text-sm text-slate-700 placeholder:text-slate-400"
                />
              </div>

              {isProcessing ? (
                <div className="mt-6 flex flex-col items-center p-4 bg-indigo-50 rounded-xl">
                  <Loader2 size={32} className="text-indigo-600 animate-spin mb-3" />
                  <span className="text-indigo-800 text-sm font-medium">{processStatus}</span>
                </div>
              ) : (
                <button
                  onClick={handleProcessDocuments}
                  disabled={!basesFile || !clasifFile || !newBracketName.trim()}
                  className="mt-6 w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Analizar y Construir Cuadro <ArrowRight size={20} />
                </button>
              )}
            </>
          )}

          {creationTab === 'manual' && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Número de Equipos</label>
                  <select
                    value={manualTeamCount}
                    onChange={(e) => setManualTeamCount(parseInt(e.target.value))}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value={4}>4 Equipos (Desde Semifinales)</option>
                    <option value={8}>8 Equipos (Desde Cuartos)</option>
                    <option value={16}>16 Equipos (Desde Octavos)</option>
                    <option value={32}>32 Equipos (Dieciseisavos)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Formato Defecto</label>
                  <select
                    value={manualFormat}
                    onChange={(e) => setManualFormat(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Partido único">Partido único</option>
                    <option value="Ida y Vuelta">Ida y Vuelta (2 partidos)</option>
                    <option value="Al mejor de 3">Al mejor de 3</option>
                  </select>
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
                Se generará una estructura de cruces vacía. Podrás añadir los equipos manualmente y editar las fechas y
                títulos en la siguiente pantalla.
              </p>

              <button
                onClick={handleCreateManualBracket}
                disabled={!newBracketName.trim()}
                className="mt-2 w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generar Cuadro Vacío <ArrowRight size={20} />
              </button>
            </>
          )}

          {creationTab === 'import' && (
            <>
              <input type="file" className="hidden" ref={fileInputImport} accept=".json" onChange={handleImport} />
              <div
                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-10 text-center cursor-pointer transition-colors"
                onClick={() => fileInputImport.current?.click()}
              >
                <Upload size={36} className="mx-auto text-slate-400 mb-3" />
                <p className="font-medium text-slate-700 mb-1">Selecciona un archivo .json</p>
                <p className="text-xs text-slate-500">
                  Sube un cuadro exportado desde otro usuario. Podrás revisarlo y editarlo antes de guardar.
                </p>
              </div>
            </>
          )}

          {errorMsg && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg text-sm text-center">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
