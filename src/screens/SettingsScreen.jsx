import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Building2, Database, AlertTriangle,
  LogOut, Download, Upload, Trash2, Link, Check, ChevronRight,
  Shield, Phone, Calendar, CreditCard, Stethoscope
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  subscribeToProfile, saveProfile, uploadLogoClub,
  exportUserData, importUserData, deleteAllUserData
} from '../services/settingsService';

const ROLES_STAFF = ['Entrenador', 'Entrenador asistente', 'Fisioterapeuta', 'Delegado', 'Médico', 'Otro'];

const EMPTY_PROFILE = {
  nombre: '', fechaNacimiento: '', dni: '', telefono: '',
  licencia: '', alergias: '', rol: 'Entrenador',
  autoAddToTeams: false, nombreClub: '', logoClub: '',
};

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { user, handleLogout, handleLinkGoogle, handleDeleteAuthAccount } = useAuth();
  const { db, appId, storage } = useFirebase();

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkedOk, setLinkedOk] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const importInputRef = useRef(null);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToProfile(user.uid, db, appId, data => {
      const merged = { ...EMPTY_PROFILE, ...data };
      setProfile(merged);
      setForm(merged);
    });
  }, [user, db, appId]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await saveProfile(form, { uid: user.uid, db, appId });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setSavingProfile(false);
    }
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportUserData(user.uid, db, appId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `urocoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version || !data.exportDate) throw new Error('Formato de archivo no reconocido.');
      setImportPreview(data);
    } catch (err) {
      setImportError(err.message || 'Archivo inválido. Usa un backup exportado desde Urocoach.');
    }
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    setImporting(true);
    try {
      await importUserData(importPreview, { uid: user.uid, db, appId });
      setImportPreview(null);
    } finally {
      setImporting(false);
    }
  }

  // ─── Link Google ──────────────────────────────────────────────────────────

  async function handleLink() {
    setLinkingGoogle(true);
    setLinkError('');
    try {
      await handleLinkGoogle();
      setLinkedOk(true);
    } catch (err) {
      setLinkError('No se pudo vincular la cuenta. Inténtalo de nuevo.');
    } finally {
      setLinkingGoogle(false);
    }
  }

  // ─── Delete account ───────────────────────────────────────────────────────

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'ELIMINAR') return;
    setDeletingAccount(true);
    try {
      await deleteAllUserData(user.uid, db, appId);
      await handleDeleteAuthAccount();
    } catch (err) {
      console.error(err);
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  }

  const isAnonymous = user?.isAnonymous;
  const emailDisplay = user?.email || (isAnonymous ? 'Cuenta de invitado' : '—');

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-24">

      {/* Header */}
      <div className="bg-blue-950 px-5 pt-10 pb-6">
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-blue-400 hover:text-white text-sm font-medium transition mb-4">
          <ArrowLeft size={16} /> Inicio
        </button>
        <h1 className="text-white text-2xl font-bold">Ajustes</h1>
        <p className="text-blue-400 text-sm mt-0.5">Perfil, club y configuración de la cuenta</p>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 flex flex-col gap-6">

        {/* ─── Perfil ─── */}
        <Section icon={User} title="Mi perfil como entrenador" iconColor="text-blue-600" iconBg="bg-blue-50">
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">

            <Field label="Nombre completo">
              <input type="text" placeholder="Nombre y apellidos"
                value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha de nacimiento">
                <input type="date" value={form.fechaNacimiento}
                  onChange={e => setForm(f => ({ ...f, fechaNacimiento: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="DNI / NIE">
                <input type="text" placeholder="00000000X"
                  value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))}
                  className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Teléfono">
                <input type="tel" placeholder="+34 600 000 000"
                  value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Nº Licencia FBM">
                <input type="text" placeholder="Licencia de entrenador"
                  value={form.licencia} onChange={e => setForm(f => ({ ...f, licencia: e.target.value }))}
                  className={inputCls} />
              </Field>
            </div>

            <Field label="Alergias / notas médicas">
              <textarea rows={2} placeholder="Sin alergias conocidas..."
                value={form.alergias} onChange={e => setForm(f => ({ ...f, alergias: e.target.value }))}
                className={inputCls + ' resize-none'} />
            </Field>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Auto-añadirme al crear equipos</p>
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Añadirme como staff automáticamente</p>
                  <p className="text-xs text-slate-500">Al crear un equipo, apareceré en el staff con mis datos</p>
                </div>
                <Toggle
                  checked={form.autoAddToTeams}
                  onChange={v => setForm(f => ({ ...f, autoAddToTeams: v }))}
                />
              </div>

              {form.autoAddToTeams && (
                <Field label="Rol por defecto" className="mt-3">
                  <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                    className={inputCls + ' bg-white'}>
                    {ROLES_STAFF.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <button type="submit" disabled={savingProfile}
              className={`w-full font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 ${profileSaved ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}>
              {profileSaved ? <><Check size={16} /> Guardado</> : savingProfile ? 'Guardando...' : 'Guardar perfil'}
            </button>
          </form>
        </Section>

        {/* ─── Club ─── */}
        <Section icon={Building2} title="Club" iconColor="text-violet-600" iconBg="bg-violet-50">
          <Field label="Nombre del club">
            <input type="text" placeholder="Uros de Rivas..."
              value={form.nombreClub} onChange={e => setForm(f => ({ ...f, nombreClub: e.target.value }))}
              className={inputCls} />
          </Field>
          <p className="text-xs text-slate-500 mt-1.5 mb-4">Aparece en las fichas de entrenamiento y el cuaderno.</p>

          {/* Logo del club */}
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={form.logoClub || '/logo-club.png'}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
              <span style={{ display: 'none' }} className="text-xs text-slate-400 text-center leading-tight px-1">Sin logo</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 mb-1">Logo del club</p>
              <p className="text-xs text-slate-500 mb-2">Aparece en la portada y cabeceras del cuaderno.</p>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="text-sm font-bold text-violet-600 hover:text-violet-800 transition disabled:opacity-50"
              >
                {uploadingLogo ? 'Subiendo...' : form.logoClub ? 'Cambiar logo' : 'Subir logo'}
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = '';
                  setUploadingLogo(true);
                  try {
                    const url = await uploadLogoClub(file, { uid: user.uid, storage, db, appId });
                    setForm(f => ({ ...f, logoClub: url }));
                  } finally {
                    setUploadingLogo(false);
                  }
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setSavingProfile(true);
              try {
                await saveProfile({ nombreClub: form.nombreClub }, { uid: user.uid, db, appId });
                setProfileSaved(true);
                setTimeout(() => setProfileSaved(false), 2000);
              } finally { setSavingProfile(false); }
            }}
            disabled={savingProfile}
            className="mt-3 w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-xl transition disabled:opacity-60 text-sm"
          >
            {savingProfile ? 'Guardando...' : 'Guardar nombre'}
          </button>
        </Section>

        {/* ─── Datos ─── */}
        <Section icon={Database} title="Mis datos" iconColor="text-emerald-600" iconBg="bg-emerald-50">
          <p className="text-xs text-slate-500 mb-4">
            Exporta todos tus datos (equipos, jugadores, entrenamientos, ejercicios y calendario) como copia de seguridad,
            o impórtalos desde un backup anterior. La importación añade sin borrar datos existentes.
          </p>

          {/* Export */}
          <button onClick={handleExport} disabled={exporting}
            className="w-full flex items-center gap-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 px-4 rounded-xl transition disabled:opacity-60 text-sm">
            <Download size={18} className="shrink-0" />
            <div className="text-left">
              <p className="font-bold">{exporting ? 'Exportando...' : 'Exportar mis datos'}</p>
              <p className="text-xs font-normal text-emerald-600">Descarga un archivo .json con todo tu contenido</p>
            </div>
          </button>

          {/* Import */}
          <button onClick={() => importInputRef.current?.click()}
            className="w-full flex items-center gap-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-3 px-4 rounded-xl transition text-sm mt-3">
            <Upload size={18} className="shrink-0" />
            <div className="text-left">
              <p className="font-bold">Importar datos</p>
              <p className="text-xs font-normal text-blue-600">Restaurar desde un backup .json de Urocoach</p>
            </div>
          </button>
          <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

          {importError && (
            <p className="text-sm text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2">{importError}</p>
          )}
        </Section>

        {/* ─── Cuenta ─── */}
        <Section icon={Shield} title="Cuenta" iconColor="text-slate-600" iconBg="bg-slate-100">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{emailDisplay}</p>
              </div>
            </div>

            {isAnonymous && !linkedOk && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">Cuenta de invitado</p>
                <p className="text-xs text-amber-700 mb-3">
                  Vincula tu cuenta con Google para no perder tus datos si cambias de dispositivo o navegador.
                </p>
                {linkError && <p className="text-xs text-red-600 mb-2">{linkError}</p>}
                <button onClick={handleLink} disabled={linkingGoogle}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-xl transition disabled:opacity-60">
                  <Link size={15} /> {linkingGoogle ? 'Vinculando...' : 'Vincular con Google'}
                </button>
              </div>
            )}

            {linkedOk && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-700 text-sm font-semibold">
                <Check size={16} /> Cuenta vinculada correctamente
              </div>
            )}

            <button onClick={handleLogout}
              className="flex items-center gap-3 text-slate-600 hover:text-red-600 font-semibold text-sm py-2 transition">
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </Section>

        {/* ─── Zona peligrosa ─── */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border-b border-red-100">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="font-bold text-red-700 text-sm">Zona peligrosa</p>
              <p className="text-xs text-red-500">Acciones irreversibles</p>
            </div>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-slate-600 mb-4">
              Eliminar tu cuenta borrará permanentemente todos tus equipos, jugadores, entrenamientos, ejercicios y sesiones del calendario.
              <span className="font-semibold text-red-600"> Esta acción no se puede deshacer.</span>
            </p>
            <button
              onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition"
            >
              <Trash2 size={15} /> Eliminar mi cuenta y todos mis datos
            </button>
          </div>
        </div>

        <div className="h-4" />
      </div>

      {/* ─── Modal preview importación ─── */}
      {importPreview && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setImportPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Confirmar importación</h3>
            <p className="text-slate-500 text-sm mb-4">
              Backup del <span className="font-semibold">{new Date(importPreview.exportDate).toLocaleDateString('es-ES')}</span>
            </p>
            <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-2 mb-5 text-sm">
              <ImportCount label="Equipos" count={importPreview.teams?.length || 0} />
              <ImportCount label="Ejercicios" count={importPreview.exercises?.length || 0} />
              <ImportCount label="Sesiones calendario" count={importPreview.calendarSessions?.length || 0} />
              <ImportCount label="Entrenamientos" count={Object.values(importPreview.trainings || {}).reduce((a, b) => a + b.length, 0)} />
            </div>
            <p className="text-xs text-slate-500 mb-4">Los datos se añadirán sin borrar tu contenido actual.</p>
            <div className="flex gap-3">
              <button onClick={() => setImportPreview(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm">Cancelar</button>
              <button onClick={handleConfirmImport} disabled={importing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 text-sm">
                {importing ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal confirmación borrado cuenta ─── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">¿Eliminar tu cuenta?</h3>
            </div>
            <p className="text-slate-600 text-sm mb-4">
              Esto borrará permanentemente <span className="font-semibold">todos tus datos</span>. Esta acción no puede deshacerse.
            </p>
            <p className="text-xs font-bold text-slate-500 mb-2">Escribe <span className="text-red-600 font-black">ELIMINAR</span> para confirmar:</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="ELIMINAR"
              className="w-full border-2 border-slate-300 focus:border-red-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none mb-4 font-bold tracking-wide"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm">Cancelar</button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'ELIMINAR' || deletingAccount}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 text-sm">
                {deletingAccount ? 'Eliminando...' : 'Eliminar todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────

function Section({ icon: Icon, title, iconColor, iconBg, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
          <Icon size={18} className={iconColor} />
        </div>
        <p className="font-bold text-slate-800">{title}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function ImportCount({ label, count }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <span className="font-bold text-slate-800">{count}</span>
    </div>
  );
}

const inputCls = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
