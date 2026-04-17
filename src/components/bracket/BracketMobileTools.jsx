import React, { useState } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  FileDigit,
  Share2,
  ImageDown,
  ShieldHalf,
  ChevronDown,
  Undo2,
  Redo2,
} from 'lucide-react';
import TeamSearchableSelect from '../TeamSearchableSelect';
import { teamDisplayName } from '../../utils/teamUtils';
import ToolbarButton from './ToolbarButton';

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
        className="absolute bottom-0 left-0 right-0 bg-blue-900 rounded-t-2xl p-5 flex flex-col gap-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="text-white font-bold text-base">Acciones del torneo</span>
          <button
            onClick={() => setShowMobileTools(false)}
            aria-label="Cerrar"
            className="p-1 text-blue-300 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {canEdit && (
          <ToolbarButton
            variant="accent"
            size="mobile"
            icon={FileDigit}
            label="✨ Autocompletar PDF"
            onClick={() => {
              if (!isProcessingResults) fileInputResults.current?.click();
            }}
            disabled={isProcessingResults}
          />
        )}

        <ToolbarButton
          variant="primary"
          size="mobile"
          icon={Share2}
          label={activeBracket.shareCode ? 'Gestionar compartir' : 'Compartir cuadro'}
          onClick={() => {
            setShowMobileTools(false);
            handleShare(activeBracket);
          }}
        />

        {activeBracket.allTeams?.length > 0 && (
          <TeamSearchableSelect
            key={activeBracketId}
            teams={activeBracket.allTeams}
            selectedTeam={activeBracket.myTeam || ''}
            onSelectTeam={handleSetMyTeam}
          />
        )}

        {activeBracket.teamName ? (
          <div className="flex items-center justify-between bg-blue-800 px-4 py-3 rounded-lg">
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
                className="flex items-center gap-3 w-full bg-blue-800 text-blue-200 px-4 py-3 rounded-lg text-sm font-bold"
              >
                <ShieldHalf size={16} /> Vincular equipo <ChevronDown size={14} className="ml-auto" />
              </button>
              {showLinkDropdown && (
                <div className="mt-1 bg-blue-800 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
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

        {canEdit && (
          <div className="flex gap-2">
            <ToolbarButton
              variant="ghost"
              size="mobile"
              icon={Undo2}
              label="Deshacer"
              onClick={() => {
                handleUndo();
                setShowMobileTools(false);
              }}
              disabled={!canUndo}
              className="flex-1"
            />
            <ToolbarButton
              variant="ghost"
              size="mobile"
              icon={Redo2}
              label="Rehacer"
              onClick={() => {
                handleRedo();
                setShowMobileTools(false);
              }}
              disabled={!canRedo}
              className="flex-1"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-blue-200 text-sm font-medium shrink-0">Zoom</span>
          <div className="flex bg-blue-800 rounded-lg border border-blue-700 flex-1 h-11 overflow-hidden">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              aria-label="Reducir zoom"
              className="flex-1 flex justify-center items-center hover:bg-blue-700"
            >
              <ZoomOut size={18} />
            </button>
            <div className="px-3 text-sm border-x border-blue-700 flex items-center justify-center w-16">
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
              aria-label="Aumentar zoom"
              className="flex-1 flex justify-center items-center hover:bg-blue-700"
            >
              <ZoomIn size={18} />
            </button>
          </div>
        </div>

        <hr className="border-blue-800 my-1" />

        <ToolbarButton
          variant="ghost"
          size="mobile"
          icon={ImageDown}
          label={isExportingImage ? 'Generando...' : 'Descargar imagen'}
          onClick={() => {
            setShowMobileTools(false);
            handleDownloadImage();
          }}
          disabled={isExportingImage}
        />
        {canEdit && (
          <ToolbarButton
            variant="danger"
            size="mobile"
            icon={RefreshCw}
            label="Limpiar puntuaciones"
            onClick={() => {
              setShowResetModal(true);
              setShowMobileTools(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
