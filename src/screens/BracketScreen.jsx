import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  FileDigit,
  Share2,
  ImageDown,
  MoreVertical,
  Users,
  Eye,
  ShieldHalf,
  ChevronDown,
  Loader2,
  Undo2,
  Redo2,
  Edit2,
} from 'lucide-react';
import { teamDisplayName } from '../utils/teamUtils';
import { doc, setDoc } from 'firebase/firestore';
import logger from '../utils/logger';
import BracketNode from '../components/BracketNode';
import TeamSearchableSelect from '../components/TeamSearchableSelect';
import { useBracket } from '../contexts/BracketContext';
import { useRegisterScreenContext } from '../hooks/useRegisterScreenContext';
import BracketShareModal from '../components/bracket/BracketShareModal';
import BracketMobileTools from '../components/bracket/BracketMobileTools';
import ToolbarButton from '../components/bracket/ToolbarButton';
import ToolbarOverflowMenu from '../components/bracket/ToolbarOverflowMenu';
import BulkEditTeamsModal from '../components/bracket/BulkEditTeamsModal';

export default function BracketScreen() {
  const {
    activeBracket,
    activeBracketId,
    canEdit,
    zoom,
    setZoom,
    showResetModal,
    setShowResetModal,
    confirmReset,
    saveError,
    showMobileTools,
    setShowMobileTools,
    sharingBracket,
    setSharingBracket,
    inviteEmail,
    setInviteEmail,
    invitePermission,
    setInvitePermission,
    copiedCode,
    setCopiedCode,
    editingBracketName,
    setEditingBracketName,
    bracketNameInput,
    setBracketNameInput,
    setBrackets,
    user,
    db,
    appId,
    isProcessingResults,
    isExportingImage,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleShare,
    handleDownloadImage,
    handleSetMyTeam,
    handleAddInvite,
    handleUpdateShareConfig,
    handleRemoveInvite,
    handleScoreChange,
    handleSorteoSelect,
    handleResultsUpload,
    fileInputResults,
    mainRef,
    bracketExportRef,
    remoteCursors,
    setAppMode,
    shareUrlBase,
    coachTeams,
    handleLinkTeam,
    handleUnlinkTeam,
  } = useBracket();

  useRegisterScreenContext({ bracketName: activeBracket?.name, myTeam: activeBracket?.myTeam });

  const navigate = useNavigate();
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);
  const [showBulkEditTeams, setShowBulkEditTeams] = useState(false);

  // Fit-to-screen: compute the zoom that makes the rendered bracket fit the
  // viewport width (with a 32px margin). Touchpoint for the user is clicking
  // the percentage label between zoom-out and zoom-in.
  const handleFitToScreen = useCallback(() => {
    const main = mainRef.current;
    const target = bracketExportRef.current;
    if (!main || !target) return;
    // Target's bounding rect reflects current scaling, so divide by current zoom
    // to get the natural (zoom=1) width.
    const naturalWidth = target.getBoundingClientRect().width / (zoom || 1);
    if (naturalWidth <= 0) return;
    const available = main.clientWidth - 32;
    const next = Math.max(0.4, Math.min(1.5, available / naturalWidth));
    setZoom(Number(next.toFixed(2)));
    // Snap scroll back to top after re-fitting so the coach sees the final.
    requestAnimationFrame(() => {
      main.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    });
  }, [mainRef, bracketExportRef, zoom, setZoom]);

  // Drag-to-pan on the bracket container. Touch already works natively (touch
  // scroll), this adds mouse drag for desktop and tablets with mouse.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const onMouseDown = (e) => {
      // Only the main container itself should arm drag — not clicks on cards,
      // inputs, buttons. Bail if the target lives inside an interactive element.
      if (e.button !== 0) return;
      if (e.target.closest('button, input, select, textarea, a, [role="dialog"]')) return;
      dragging = true;
      startX = e.pageX;
      startY = e.pageY;
      startScrollLeft = main.scrollLeft;
      startScrollTop = main.scrollTop;
      main.style.cursor = 'grabbing';
      main.style.userSelect = 'none';
    };
    const onMouseMove = (e) => {
      if (!dragging) return;
      main.scrollLeft = startScrollLeft - (e.pageX - startX);
      main.scrollTop = startScrollTop - (e.pageY - startY);
    };
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      main.style.cursor = '';
      main.style.userSelect = '';
    };

    main.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stop);
    main.addEventListener('mouseleave', stop);
    return () => {
      main.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stop);
      main.removeEventListener('mouseleave', stop);
    };
  }, [mainRef]);

  const handleDateClick = activeBracket?.teamId
    ? (isoDate) => navigate(`/calendar?date=${isoDate}&teamId=${activeBracket.teamId}`)
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 animate-in fade-in duration-700">
      {isProcessingResults && (
        <div className="fixed inset-0 bg-slate-900/80 z-[60] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <Loader2 size={48} className="text-blue-400 animate-spin mb-4" aria-hidden="true" />
          <h3 className="text-2xl font-bold text-white mb-2">Autocompletando...</h3>
        </div>
      )}
      {isExportingImage && (
        <div className="fixed inset-0 bg-slate-900/70 z-[60] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <Loader2 size={48} className="text-white animate-spin mb-4" aria-hidden="true" />
          <h3 className="text-xl font-bold text-white">Generando imagen...</h3>
        </div>
      )}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-xl font-bold mb-2">¿Limpiar Puntuaciones?</h3>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowResetModal(false)} className="px-4 py-2 bg-slate-100 rounded-lg">
                Cancelar
              </button>
              <button onClick={confirmReset} className="px-4 py-2 bg-red-600 text-white rounded-lg">
                Sí, limpiar
              </button>
            </div>
          </div>
        </div>
      )}
      {saveError && (
        <div className="fixed bottom-4 right-4 z-[70] bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <span>⚠️ {saveError}</span>
        </div>
      )}

      <input
        type="file"
        className="hidden"
        ref={fileInputResults}
        accept=".pdf"
        onChange={(e) => {
          handleResultsUpload(e);
          setShowMobileTools(false);
        }}
      />

      {showMobileTools && (
        <BracketMobileTools
          activeBracket={activeBracket}
          activeBracketId={activeBracketId}
          canEdit={canEdit}
          zoom={zoom}
          setZoom={setZoom}
          isProcessingResults={isProcessingResults}
          isExportingImage={isExportingImage}
          canUndo={canUndo}
          canRedo={canRedo}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          handleSetMyTeam={handleSetMyTeam}
          handleShare={handleShare}
          handleDownloadImage={handleDownloadImage}
          handleUnlinkTeam={handleUnlinkTeam}
          handleLinkTeam={handleLinkTeam}
          setShowResetModal={setShowResetModal}
          setShowMobileTools={setShowMobileTools}
          fileInputResults={fileInputResults}
          coachTeams={coachTeams}
          handleFitToScreen={handleFitToScreen}
        />
      )}

      <BulkEditTeamsModal
        open={showBulkEditTeams && canEdit}
        onClose={() => setShowBulkEditTeams(false)}
        bracketData={activeBracket?.bracketData}
      />

      <BracketShareModal
        sharingBracket={sharingBracket}
        setSharingBracket={setSharingBracket}
        user={user}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        invitePermission={invitePermission}
        setInvitePermission={setInvitePermission}
        copiedCode={copiedCode}
        setCopiedCode={setCopiedCode}
        handleAddInvite={handleAddInvite}
        handleUpdateShareConfig={handleUpdateShareConfig}
        handleRemoveInvite={handleRemoveInvite}
        shareUrlBase={shareUrlBase}
      />

      <header className="bg-blue-900 text-white shadow-md z-10 relative">
        {/* Row 1: Navigation + Info + Mobile menu */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6 lg:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setAppMode('dashboard')}
              aria-label="Volver"
              className="p-2 bg-blue-800 rounded-lg shrink-0"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              {editingBracketName ? (
                <input
                  autoFocus
                  className="text-base lg:text-lg font-bold bg-transparent border-b border-blue-400 focus:outline-none focus:border-white text-white truncate w-full"
                  value={bracketNameInput}
                  onChange={(e) => setBracketNameInput(e.target.value)}
                  onBlur={async () => {
                    const trimmed = bracketNameInput.trim();
                    if (trimmed && trimmed !== activeBracket.name) {
                      const updated = { ...activeBracket, name: trimmed };
                      setBrackets((prev) => prev.map((b) => (b.id === activeBracket.id ? updated : b)));
                      if (user && db) {
                        setDoc(
                          doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', activeBracket.id),
                          { name: trimmed },
                          { merge: true },
                        ).catch((e) => logger.warn('Error guardando nombre de bracket', e));
                      }
                    }
                    setEditingBracketName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur();
                    if (e.key === 'Escape') setEditingBracketName(false);
                  }}
                />
              ) : (
                <h1
                  className="text-base lg:text-lg font-bold truncate cursor-pointer hover:underline hover:text-blue-200 transition-colors"
                  title="Haz clic para editar el nombre"
                  onClick={() => {
                    setBracketNameInput(activeBracket.name);
                    setEditingBracketName(true);
                  }}
                >
                  {activeBracket.name}
                </h1>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-blue-300 text-xs font-semibold uppercase truncate">
                  {activeBracket.tournamentNameDetected || 'Estructura Dinámica'}
                </p>
                {activeBracket.isShared && (
                  <span className="hidden sm:inline-flex items-center gap-1 bg-blue-500/30 text-blue-100 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    <Users size={9} aria-hidden="true" /> Compartido
                  </span>
                )}
                {activeBracket.shareConfig && !canEdit && (
                  <span className="hidden sm:inline-flex items-center gap-1 bg-amber-500/30 text-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    <Eye size={9} aria-hidden="true" /> Solo lectura
                  </span>
                )}
                {activeBracket.teamName ? (
                  <span className="hidden sm:inline-flex items-center gap-1 bg-blue-500/30 text-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full group/tbadge">
                    <ShieldHalf size={9} aria-hidden="true" /> {activeBracket.teamName}
                    <button
                      onClick={() => handleUnlinkTeam(activeBracketId)}
                      className="opacity-0 group-hover/tbadge:opacity-100 hover:text-red-300 transition-opacity ml-0.5"
                    >
                      {/* X icon inline to avoid extra import */}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ) : (
                  coachTeams?.length > 0 && (
                    <div className="hidden sm:inline-block relative">
                      <button
                        onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                        className="inline-flex items-center gap-1 bg-blue-800/50 hover:bg-blue-700/50 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors"
                      >
                        <ShieldHalf size={9} aria-hidden="true" /> Vincular <ChevronDown size={9} aria-hidden="true" />
                      </button>
                      {showLinkDropdown && (
                        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[200px] max-h-48 overflow-y-auto">
                          {coachTeams.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                handleLinkTeam(activeBracketId, t);
                                setShowLinkDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              {teamDisplayName(t)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowMobileTools(true)}
            aria-label="Herramientas"
            className="lg:hidden p-2 bg-blue-800 rounded-lg shrink-0"
          >
            <MoreVertical size={20} aria-hidden="true" />
          </button>
        </div>
        {/* Row 2: Toolbar (desktop only) */}
        <div className="hidden lg:flex items-center gap-2 px-6 pb-3 flex-wrap">
          {activeBracket.allTeams?.length > 0 && (
            <TeamSearchableSelect
              key={activeBracketId}
              teams={activeBracket.allTeams}
              selectedTeam={activeBracket.myTeam || ''}
              onSelectTeam={handleSetMyTeam}
            />
          )}
          <div className="flex bg-blue-800 rounded-lg border border-blue-700 h-9 overflow-hidden">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              aria-label="Reducir zoom"
              className="px-2 hover:bg-blue-700"
            >
              <ZoomOut size={15} aria-hidden="true" />
            </button>
            <button
              onClick={handleFitToScreen}
              title="Ajustar a la pantalla"
              aria-label="Ajustar a la pantalla"
              className="px-2 text-xs border-x border-blue-700 w-14 flex items-center justify-center hover:bg-blue-700 transition-colors"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
              aria-label="Aumentar zoom"
              className="px-2 hover:bg-blue-700"
            >
              <ZoomIn size={15} aria-hidden="true" />
            </button>
          </div>
          {canEdit && (
            <div className="flex bg-blue-800 rounded-lg border border-blue-700 h-9 overflow-hidden">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                title="Deshacer (Ctrl+Z)"
                aria-label="Deshacer"
                className="px-2 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 size={15} aria-hidden="true" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                title="Rehacer (Ctrl+Y)"
                aria-label="Rehacer"
                className="px-2 border-l border-blue-700 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Redo2 size={15} aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="w-px h-6 bg-blue-700 mx-1" />
          <ToolbarButton variant="primary" icon={Share2} label="Compartir" onClick={() => handleShare(activeBracket)} />
          {canEdit && (
            <ToolbarButton
              variant="accent"
              icon={FileDigit}
              label="✨ Autocompletar PDF"
              onClick={() => !isProcessingResults && fileInputResults.current?.click()}
              disabled={isProcessingResults}
            />
          )}
          <ToolbarOverflowMenu
            items={[
              canEdit && {
                icon: Edit2,
                label: 'Editar nombres de equipos',
                onClick: () => setShowBulkEditTeams(true),
              },
              {
                icon: ImageDown,
                label: isExportingImage ? 'Generando...' : 'Descargar imagen',
                onClick: handleDownloadImage,
                disabled: isExportingImage,
              },
              canEdit && {
                icon: RefreshCw,
                label: 'Limpiar puntuaciones',
                onClick: () => setShowResetModal(true),
                danger: true,
              },
            ]}
          />
        </div>
      </header>

      <div
        ref={mainRef}
        role="region"
        aria-label="Cuadro de eliminatorias"
        className="flex-1 overflow-auto relative p-4 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] cursor-grab"
      >
        <div
          className="absolute min-w-max p-12 transition-transform origin-top-center w-full flex justify-center pb-32"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          <div ref={bracketExportRef}>
            <BracketNode
              nodeId={activeBracket.bracketData.rootId}
              bracketData={activeBracket.bracketData}
              onScoreChange={handleScoreChange}
              onSelectSorteo={handleSorteoSelect}
              myTeam={activeBracket.myTeam || ''}
              readOnly={!canEdit}
              onDateClick={handleDateClick}
            />
          </div>
        </div>
        {/* eslint-disable-next-line react-hooks/refs */}
        {Object.entries(remoteCursors).map(([uid, cursor]) => {
          const mainEl = mainRef.current;
          if (!mainEl) return null;
          return (
            <div
              key={uid}
              className="pointer-events-none absolute z-30 flex items-start gap-1"
              style={{
                left: cursor.x * mainEl.scrollWidth,
                top: cursor.y * mainEl.scrollHeight,
                transform: 'translate(0, 0)',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                className="shrink-0 drop-shadow"
                style={{ fill: cursor.color }}
              >
                <path
                  d="M1 1 L1 14 L4.5 10.5 L7.5 17 L9.5 16 L6.5 9.5 L12 9.5 Z"
                  stroke="white"
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="text-white text-[11px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap shadow-md"
                style={{ backgroundColor: cursor.color, marginTop: '14px' }}
              >
                {cursor.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
