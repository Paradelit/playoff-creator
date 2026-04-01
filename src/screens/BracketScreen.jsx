import React, { useState } from 'react';
import {
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  FileDigit,
  Share2,
  ImageDown,
  MoreVertical,
  X,
  Users,
  Eye,
  Copy,
  Check,
  Link,
  ShieldHalf,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { teamDisplayName } from './TeamsScreen';
import { doc, setDoc } from 'firebase/firestore';
import logger from '../utils/logger';
import BracketNode from '../components/BracketNode';
import TeamSearchableSelect from '../components/TeamSearchableSelect';
import { useBracket } from '../contexts/BracketContext';

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

  const [showLinkDropdown, setShowLinkDropdown] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 animate-in fade-in duration-700">
      {isProcessingResults && (
        <div className="fixed inset-0 bg-slate-900/80 z-[60] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <Loader2 size={48} className="text-indigo-400 animate-spin mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Autocompletando...</h3>
        </div>
      )}
      {isExportingImage && (
        <div className="fixed inset-0 bg-slate-900/70 z-[60] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <Loader2 size={48} className="text-white animate-spin mb-4" />
          <h3 className="text-xl font-bold text-white">Generando imagen...</h3>
        </div>
      )}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
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

      {/* Panel de herramientas mobile */}
      {showMobileTools && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setShowMobileTools(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-blue-900 rounded-t-2xl p-5 flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-white font-bold text-base">Herramientas</span>
              <button onClick={() => setShowMobileTools(false)} className="p-1 text-blue-300 hover:text-white">
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
                  className="p-3 flex-1 flex justify-center"
                >
                  <ZoomOut size={18} />
                </button>
                <div className="px-3 py-2 text-sm border-x border-blue-700 flex items-center justify-center w-16">
                  {Math.round(zoom * 100)}%
                </div>
                <button
                  onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
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
      )}

      {/* Modal de compartir */}
      {sharingBracket?.shareConfig && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSharingBracket(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Share2 size={20} className="text-blue-600" /> Compartir cuadro
              </h3>
              <button onClick={() => setSharingBracket(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-2">Invitar personas</p>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddInvite()}
                placeholder="correo@ejemplo.com"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2">
                <select
                  value={invitePermission}
                  onChange={(e) => setInvitePermission(e.target.value)}
                  className="flex-1 sm:flex-none border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none"
                >
                  <option value="view">Solo ver</option>
                  <option value="edit">Puede editar</option>
                </select>
                <button
                  onClick={handleAddInvite}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  Añadir
                </button>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-2">Personas con acceso</p>
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs">
                    {(sharingBracket.shareConfig.ownerName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-slate-700">
                    {sharingBracket.shareConfig.ownerName}{' '}
                    {sharingBracket.shareConfig.ownerId === user?.uid ? '(tú)' : ''}
                  </span>
                </div>
                <span className="text-slate-400 text-xs shrink-0 ml-2">Propietario</span>
              </div>
              {Object.entries(sharingBracket.shareConfig.invites || {}).map(([email, perm]) => (
                <div key={email} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 font-bold text-xs">
                      {email.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate text-slate-700">{email}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <select
                      value={perm}
                      onChange={(e) =>
                        handleUpdateShareConfig({
                          invites: { ...sharingBracket.shareConfig.invites, [email]: e.target.value },
                        })
                      }
                      className="border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none"
                    >
                      <option value="view">Solo ver</option>
                      <option value="edit">Puede editar</option>
                    </select>
                    <button
                      onClick={() => handleRemoveInvite(email)}
                      className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <Link size={14} /> Acceso con enlace
              </p>
              <select
                value={sharingBracket.shareConfig.linkAccess}
                onChange={(e) => handleUpdateShareConfig({ linkAccess: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="none">Sin acceso — solo las personas invitadas</option>
                <option value="view">Cualquiera con el enlace puede ver</option>
                <option value="edit">Cualquiera con el enlace puede editar</option>
              </select>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${shareUrlBase || window.location.origin + '/s'}/${sharingBracket.shareCode}`,
                  );
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors"
              >
                {copiedCode ? (
                  <>
                    <Check size={16} /> ¡Enlace copiado!
                  </>
                ) : (
                  <>
                    <Copy size={16} /> Copiar enlace
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-blue-900 text-white shadow-md z-10 relative">
        {/* Row 1: Navigation + Info + Mobile menu */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6 lg:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setAppMode('dashboard')} className="p-2 bg-blue-800 rounded-lg shrink-0">
              <ChevronLeft size={20} />
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
                  <span className="hidden sm:inline-flex items-center gap-1 bg-purple-500/30 text-purple-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    <Users size={9} /> Compartido
                  </span>
                )}
                {activeBracket.shareConfig && !canEdit && (
                  <span className="hidden sm:inline-flex items-center gap-1 bg-amber-500/30 text-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    <Eye size={9} /> Solo lectura
                  </span>
                )}
                {activeBracket.teamName ? (
                  <span className="hidden sm:inline-flex items-center gap-1 bg-blue-500/30 text-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full group/tbadge">
                    <ShieldHalf size={9} /> {activeBracket.teamName}
                    <button
                      onClick={() => handleUnlinkTeam(activeBracketId)}
                      className="opacity-0 group-hover/tbadge:opacity-100 hover:text-red-300 transition-opacity ml-0.5"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ) : (
                  coachTeams?.length > 0 && (
                    <div className="hidden sm:inline-block relative">
                      <button
                        onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                        className="inline-flex items-center gap-1 bg-blue-800/50 hover:bg-blue-700/50 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors"
                      >
                        <ShieldHalf size={9} /> Vincular <ChevronDown size={9} />
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
          <button onClick={() => setShowMobileTools(true)} className="lg:hidden p-2 bg-blue-800 rounded-lg shrink-0">
            <MoreVertical size={20} />
          </button>
        </div>
        {/* Row 2: Toolbar (desktop only) */}
        <div className="hidden lg:flex items-center gap-2 px-6 pb-3 flex-wrap">
          <button
            onClick={() => handleShare(activeBracket)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"
          >
            <Share2 size={14} /> Compartir
          </button>
          {canEdit && (
            <button
              onClick={() => !isProcessingResults && fileInputResults.current?.click()}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-700 to-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"
            >
              <FileDigit size={14} /> ✨ Autocompletar PDF
            </button>
          )}
          <TeamSearchableSelect
            key={activeBracketId}
            teams={activeBracket.allTeams}
            selectedTeam={activeBracket.myTeam || ''}
            onSelectTeam={handleSetMyTeam}
          />
          <div className="flex bg-blue-800 rounded-lg border border-blue-700">
            <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} className="p-1.5">
              <ZoomOut size={15} />
            </button>
            <div className="px-2 py-1.5 text-xs border-x border-blue-700 w-12 text-center">
              {Math.round(zoom * 100)}%
            </div>
            <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} className="p-1.5">
              <ZoomIn size={15} />
            </button>
          </div>
          {canEdit && (
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Deshacer"
              className="bg-blue-800 hover:bg-blue-700 disabled:opacity-40 text-white p-1.5 rounded-lg text-sm"
            >
              ↩
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Rehacer"
              className="bg-blue-800 hover:bg-blue-700 disabled:opacity-40 text-white p-1.5 rounded-lg text-sm"
            >
              ↪
            </button>
          )}
          <button
            onClick={handleDownloadImage}
            disabled={isExportingImage}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
          >
            <ImageDown size={14} /> Imagen
          </button>
          {canEdit && (
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              <RefreshCw size={14} /> Limpiar
            </button>
          )}
        </div>
      </header>

      <main
        ref={mainRef}
        className="flex-1 overflow-auto relative p-4 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
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
      </main>
    </div>
  );
}
