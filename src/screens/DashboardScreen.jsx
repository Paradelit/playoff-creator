import React from 'react';
import { Trophy, Plus, Upload, Download, Trash2, Share2, Users, ArrowRight, FolderOpen, Cloud, CloudOff, LogOut, Link, X, Check, Copy, ShieldHalf } from 'lucide-react';

export default function DashboardScreen({
  user, brackets, firebaseError,
  dashboardSearch, setDashboardSearch,
  dashboardSort, setDashboardSort,
  setActiveBracketId, setAppMode, setZoom,
  handleShare, handleExport, handleDeleteBracket,
  bracketToDelete, setBracketToDelete, confirmDelete,
  handleLogout, fileInputImport, handleImport,
  sharingBracket, setSharingBracket,
  inviteEmail, setInviteEmail,
  invitePermission, setInvitePermission,
  copiedCode, setCopiedCode,
  handleAddInvite, handleUpdateShareConfig, handleRemoveInvite,
  shareUrlBase,
}) {
  return (
    <div className="min-h-screen bg-slate-100 p-6 sm:p-12 font-sans">
      {/* Modal de compartir */}
      {sharingBracket?.shareConfig && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSharingBracket(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Share2 size={20} className="text-blue-600" /> Compartir cuadro</h3>
              <button onClick={() => setSharingBracket(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-2">Invitar personas</p>
            <div className="flex gap-2 mb-4">
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddInvite()} placeholder="correo@ejemplo.com" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <select value={invitePermission} onChange={e => setInvitePermission(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none">
                <option value="view">Solo ver</option>
                <option value="edit">Puede editar</option>
              </select>
              <button onClick={handleAddInvite} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors">Añadir</button>
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-2">Personas con acceso</p>
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs">{(sharingBracket.shareConfig.ownerName || 'U').charAt(0).toUpperCase()}</div>
                  <span className="truncate text-slate-700">{sharingBracket.shareConfig.ownerName} {sharingBracket.shareConfig.ownerId === user?.uid ? '(tú)' : ''}</span>
                </div>
                <span className="text-slate-400 text-xs shrink-0 ml-2">Propietario</span>
              </div>
              {Object.entries(sharingBracket.shareConfig.invites || {}).map(([email, perm]) => (
                <div key={email} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 font-bold text-xs">{email.charAt(0).toUpperCase()}</div>
                    <span className="truncate text-slate-700">{email}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <select value={perm} onChange={e => handleUpdateShareConfig({ invites: { ...sharingBracket.shareConfig.invites, [email]: e.target.value } })} className="border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none">
                      <option value="view">Solo ver</option>
                      <option value="edit">Puede editar</option>
                    </select>
                    <button onClick={() => handleRemoveInvite(email)} className="text-slate-300 hover:text-red-500 p-1 transition-colors"><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1.5"><Link size={14} /> Acceso con enlace</p>
              <select value={sharingBracket.shareConfig.linkAccess} onChange={e => handleUpdateShareConfig({ linkAccess: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="none">Sin acceso — solo las personas invitadas</option>
                <option value="view">Cualquiera con el enlace puede ver</option>
                <option value="edit">Cualquiera con el enlace puede editar</option>
              </select>
              <button onClick={() => { navigator.clipboard.writeText(`${shareUrlBase || window.location.origin + '/s'}/${sharingBracket.shareCode}`); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors">
                {copiedCode ? <><Check size={16} /> ¡Enlace copiado!</> : <><Copy size={16} /> Copiar enlace</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de eliminar */}
      {bracketToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-2 text-slate-800">¿Eliminar Torneo?</h3>
            <p className="text-slate-600 mb-6 text-sm">Esta acción borrará el torneo y todos sus resultados permanentemente.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBracketToDelete(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Header con usuario */}
        <div className="flex justify-end mb-4">
          {user && (
            <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
              <div className="flex items-center gap-2">
                {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{user.email ? user.email.charAt(0).toUpperCase() : 'I'}</div>}
                <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.isAnonymous ? 'Invitado' : (user.displayName || user.email)}</span>
              </div>
              <div className="w-px h-4 bg-slate-300"></div>
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-500 flex items-center gap-1 text-sm font-medium transition">
                <LogOut size={16} /> Salir
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3"><Trophy className="text-amber-500" size={36} /> Mis Torneos</h1>
            <p className="text-slate-500 mt-2">Plataforma dinámica de cuadros deportivos impulsada por IA.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${firebaseError ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
              {firebaseError ? <CloudOff size={14} /> : <Cloud size={14} />}
              {firebaseError ? 'Solo Local' : 'Guardado en la Nube'}
            </div>
            <input type="file" className="hidden" ref={fileInputImport} accept=".json" onChange={handleImport} />
            <button onClick={() => fileInputImport.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-300 transition-colors"><Upload size={18} /> Importar</button>
            <button onClick={() => setAppMode('upload')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"><Plus size={20} /> Nuevo Cuadro IA</button>
          </div>
        </div>

        {firebaseError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-xl mb-6 flex items-center gap-3">
            ⚠️ Estás usando la aplicación sin configurar la Autenticación de Firebase localmente. Los torneos se borrarán si recargas la página.
          </div>
        )}

        {brackets.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input type="text" value={dashboardSearch} onChange={e => setDashboardSearch(e.target.value)} placeholder="Buscar torneo..." className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
            <select value={dashboardSort} onChange={e => setDashboardSort(e.target.value)} className="px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white">
              <option value="recent">Más reciente</option>
              <option value="oldest">Más antiguo</option>
              <option value="name">Nombre A-Z</option>
              <option value="shared">Compartidos primero</option>
            </select>
          </div>
        )}

        {(() => {
          const filteredSorted = brackets
            .filter(b => dashboardSearch === '' ||
              b.name.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
              (b.tournamentNameDetected || '').toLowerCase().includes(dashboardSearch.toLowerCase())
            )
            .sort((a, b) => {
              if (dashboardSort === 'recent') return b.createdAt - a.createdAt;
              if (dashboardSort === 'oldest') return a.createdAt - b.createdAt;
              if (dashboardSort === 'name') return a.name.localeCompare(b.name);
              if (dashboardSort === 'shared') return (b.isShared ? 1 : 0) - (a.isShared ? 1 : 0);
              return 0;
            });

          if (brackets.length === 0) return (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center shadow-sm">
              <FolderOpen size={64} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">Aún no tienes torneos creados</h3>
              <p className="text-slate-500 mb-6">Sube las bases de la FBM y tu clasificación para empezar.</p>
              <button onClick={() => setAppMode('upload')} className="text-blue-600 font-bold hover:underline">Analizar competición ahora</button>
            </div>
          );

          if (filteredSorted.length === 0) return (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center shadow-sm">
              <p className="text-slate-500">No se encontraron torneos para "<strong>{dashboardSearch}</strong>"</p>
            </div>
          );

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSorted.map(b => (
                <div key={`bracket-card-${b.id}`} className={`bg-white rounded-xl shadow-md border p-6 flex flex-col hover:shadow-xl transition-shadow ${b.isShared ? 'border-purple-200' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-xl font-bold text-slate-800 truncate">{b.name}</h3>
                    {b.isShared && <span className="shrink-0 flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full"><Users size={11} /> Compartido</span>}
                  </div>
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1 truncate">{b.tournamentNameDetected || 'Competición'}</p>
                  {b.teamName && (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold mb-3">
                      <ShieldHalf size={10} /> {b.teamName}
                    </span>
                  )}
                  {b.shareCode && <p className="text-xs text-slate-400 mb-3 flex items-center gap-1"><Link size={11} /> Enlace de compartir activo</p>}
                  <div className="flex justify-between items-center mt-auto border-t border-slate-100 pt-4">
                    <button onClick={() => { setActiveBracketId(b.id); localStorage.setItem('playoffs:lastActiveBracketId', b.id); setAppMode('bracket'); setZoom(1); }} className="text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1">Abrir cuadro <ArrowRight size={16} /></button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleShare(b)} className="text-slate-400 hover:text-purple-600 p-2 hover:bg-purple-50 rounded-lg transition-colors" title="Compartir cuadro"><Share2 size={18} /></button>
                      <button onClick={() => handleExport(b)} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors" title="Exportar cuadro"><Download size={18} /></button>
                      <button onClick={() => handleDeleteBracket(b.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar cuadro"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
