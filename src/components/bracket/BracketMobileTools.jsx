import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RefreshCw, FileDigit, Share2, ImageDown, ShieldHalf, ChevronDown } from 'lucide-react';
import TeamSearchableSelect from '../TeamSearchableSelect';
import { teamDisplayName } from '../../utils/teamUtils';

export default function BracketMobileTools({
  activeBracket,
  activeBracketId,
  canEdit,
  zoom,
  setZoom,
  isProcessingResults,
  isExportingImage,
  canUndo,
  canRedo,
  handleUndo,
  handleRedo,
  handleSetMyTeam,
  handleShare,
  handleDownloadImage,
  handleUnlinkTeam,
  handleLinkTeam,
  setShowResetModal,
  setShowMobileTools,
  fileInputResults,
  coachTeams,
}) {
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);

  return (
    <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setShowMobileTools(false)}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-blue-900 rounded-t-2xl p-5 flex flex-col gap-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="text-white font-bold text-base">Herramientas</span>
          <button
            onClick={() => setShowMobileTools(false)}
            aria-label="Cerrar"
            className="p-1 text-blue-300 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              if (!isProcessingResults) fileInputResults.current?.click();
            }}
            className="flex items-center gap-3 bg-gradient-to-r from-blue-700 to-blue-500 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-md"
          >
            <FileDigit size={18} /> ✨ Autocompletar PDF
          </button>
        )}
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                handleUndo();
                setShowMobileTools(false);
              }}
              disabled={!canUndo}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-800 disabled:opacity-40 px-3 py-2.5 rounded-xl text-sm font-bold"
            >
              ↩ Deshacer
            </button>
            <button
              onClick={() => {
                handleRedo();
                setShowMobileTools(false);
              }}
              disabled={!canRedo}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-800 disabled:opacity-40 px-3 py-2.5 rounded-xl text-sm font-bold"
            >
              ↪ Rehacer
            </button>
          </div>
        )}
        <TeamSearchableSelect
          key={activeBracketId}
          teams={activeBracket.allTeams}
          selectedTeam={activeBracket.myTeam || ''}
          onSelectTeam={handleSetMyTeam}
        />
        {activeBracket.teamName ? (
          <div className="flex items-center justify-between bg-blue-800 px-4 py-3 rounded-xl">
            <span className="flex items-center gap-2 text-sm font-bold text-blue-200">
              <ShieldHalf size={14} /> {activeBracket.teamName}
            </span>
            <button
              onClick={() => {
                handleUnlinkTeam(activeBracketId);
                setShowMobileTools(false);
              }}
              className="text-blue-400 hover:text-red-300 text-xs font-bold"
            >
              Desvincular
            </button>
          </div>
        ) : (
          coachTeams?.length > 0 && (
            <div>
              <button
                onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                className="flex items-center gap-3 w-full bg-blue-800 text-blue-200 px-4 py-3 rounded-xl text-sm font-bold"
              >
                <ShieldHalf size={18} /> Vincular equipo <ChevronDown size={14} className="ml-auto" />
              </button>
              {showLinkDropdown && (
                <div className="mt-1 bg-blue-800 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {coachTeams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        handleLinkTeam(activeBracketId, t);
                        setShowLinkDropdown(false);
                        setShowMobileTools(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-100 hover:bg-blue-700 transition-colors border-t border-blue-700/50"
                    >
                      {teamDisplayName(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        <div className="flex items-center gap-3">
          <span className="text-blue-200 text-sm font-medium shrink-0">Zoom</span>
          <div className="flex bg-blue-800 rounded-lg border border-blue-700 flex-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              aria-label="Reducir zoom"
              className="p-3 flex-1 flex justify-center"
            >
              <ZoomOut size={18} />
            </button>
            <div className="px-3 py-2 text-sm border-x border-blue-700 flex items-center justify-center w-16">
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
              aria-label="Aumentar zoom"
              className="p-3 flex-1 flex justify-center"
            >
              <ZoomIn size={18} />
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            setShowMobileTools(false);
            handleShare(activeBracket);
          }}
          className="flex items-center justify-center gap-2 bg-blue-600 px-4 py-3 rounded-xl text-sm font-bold"
        >
          <Share2 size={16} /> {activeBracket.shareCode ? 'Gestionar compartir' : 'Compartir cuadro'}
        </button>
        <button
          onClick={() => {
            setShowMobileTools(false);
            handleDownloadImage();
          }}
          disabled={isExportingImage}
          className="flex items-center justify-center gap-2 bg-slate-600 disabled:opacity-50 px-4 py-3 rounded-xl text-sm font-bold"
        >
          <ImageDown size={16} /> {isExportingImage ? 'Generando...' : 'Descargar imagen'}
        </button>
        {canEdit && (
          <button
            onClick={() => {
              setShowResetModal(true);
              setShowMobileTools(false);
            }}
            className="flex items-center justify-center gap-2 bg-red-600 px-4 py-3 rounded-xl text-sm font-bold"
          >
            <RefreshCw size={16} /> Limpiar puntuaciones
          </button>
        )}
      </div>
    </div>
  );
}
