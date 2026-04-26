import React from 'react';
import {
  User,
  Building2,
  Database,
  AlertTriangle,
  LogOut,
  Download,
  Upload,
  Trash2,
  Link,
  Check,
  Shield,
  Bell,
  Sparkles,
} from 'lucide-react';

const ROLES_STAFF = ['Entrenador', 'Entrenador asistente', 'Fisioterapeuta', 'Delegado', 'Médico', 'Otro'];

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

function Field({ label, htmlFor, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  );
}

const inputCls =
  'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

export function ProfileSection({ s }) {
  return (
    <Section icon={User} title="Mi perfil como entrenador" iconColor="text-blue-600" iconBg="bg-blue-50">
      <form onSubmit={s.handleSaveProfile} className="flex flex-col gap-4">
        <Field label="Nombre completo">
          <input
            type="text"
            placeholder="Nombre y apellidos"
            value={s.form.nombre}
            onChange={(e) => s.setForm((f) => ({ ...f, nombre: e.target.value }))}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de nacimiento">
            <input
              type="date"
              value={s.form.fechaNacimiento}
              onChange={(e) => s.setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="DNI / NIE">
            <input
              type="text"
              placeholder="00000000X"
              value={s.form.dni}
              onChange={(e) => s.setForm((f) => ({ ...f, dni: e.target.value }))}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono">
            <input
              type="tel"
              placeholder="+34 600 000 000"
              value={s.form.telefono}
              onChange={(e) => s.setForm((f) => ({ ...f, telefono: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="Nº Licencia FBM">
            <input
              type="text"
              placeholder="Licencia de entrenador"
              value={s.form.licencia}
              onChange={(e) => s.setForm((f) => ({ ...f, licencia: e.target.value }))}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Alergias / notas médicas">
          <textarea
            rows={2}
            placeholder="Sin alergias conocidas..."
            value={s.form.alergias}
            onChange={(e) => s.setForm((f) => ({ ...f, alergias: e.target.value }))}
            className={inputCls + ' resize-none'}
          />
        </Field>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
            Auto-añadirme al crear equipos
          </p>
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">Añadirme como staff automáticamente</p>
              <p className="text-xs text-slate-500">Al crear un equipo, apareceré en el staff con mis datos</p>
            </div>
            <Toggle
              checked={s.form.autoAddToTeams}
              onChange={(v) => s.setForm((f) => ({ ...f, autoAddToTeams: v }))}
              label="Añadirme como staff automáticamente"
            />
          </div>

          {s.form.autoAddToTeams && (
            <Field label="Rol por defecto" className="mt-3">
              <select
                value={s.form.rol}
                onChange={(e) => s.setForm((f) => ({ ...f, rol: e.target.value }))}
                className={inputCls + ' bg-white'}
              >
                {ROLES_STAFF.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <button
          type="submit"
          disabled={s.savingProfile}
          className={`w-full font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 ${s.profileSaved ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}
        >
          {s.profileSaved ? (
            <>
              <Check size={16} aria-hidden="true" /> Guardado
            </>
          ) : s.savingProfile ? (
            'Guardando...'
          ) : (
            'Guardar perfil'
          )}
        </button>
      </form>
    </Section>
  );
}

export function ClubSection({ s }) {
  return (
    <Section icon={Building2} title="Club" iconColor="text-violet-600" iconBg="bg-violet-50">
      <Field label="Nombre del club">
        <input
          type="text"
          placeholder="Uros de Rivas..."
          value={s.form.nombreClub}
          onChange={(e) => s.setForm((f) => ({ ...f, nombreClub: e.target.value }))}
          className={inputCls}
        />
      </Field>
      <p className="text-xs text-slate-500 mt-1.5 mb-4">Aparece en las fichas de entrenamiento y el cuaderno.</p>

      <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
          <img
            src={s.form.logoClub || '/logo-club.png'}
            alt="Logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <span style={{ display: 'none' }} className="text-xs text-slate-400 text-center leading-tight px-1">
            Sin logo
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 mb-1">Logo del club</p>
          <p className="text-xs text-slate-500 mb-2">Aparece en la portada y cabeceras del cuaderno.</p>
          <button
            type="button"
            onClick={() => s.logoInputRef.current?.click()}
            disabled={s.uploadingLogo}
            className="text-sm font-bold text-violet-600 hover:text-violet-800 transition disabled:opacity-50"
          >
            {s.uploadingLogo ? 'Subiendo...' : s.form.logoClub ? 'Cambiar logo' : 'Subir logo'}
          </button>
          <input ref={s.logoInputRef} type="file" accept="image/*" className="hidden" onChange={s.handleLogoUpload} />
        </div>
      </div>

      <button
        type="button"
        onClick={s.handleSaveClubName}
        disabled={s.savingProfile}
        className="mt-3 w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-xl transition disabled:opacity-60 text-sm"
      >
        {s.savingProfile ? 'Guardando...' : 'Guardar nombre'}
      </button>
    </Section>
  );
}

export function RemindersSection({ s }) {
  return (
    <Section icon={Bell} title="Recordatorios" iconColor="text-orange-600" iconBg="bg-orange-50">
      <p className="text-xs text-slate-500 mb-4">
        Recibe recordatorios en el navegador antes de tus sesiones. Necesita permiso de notificaciones.
      </p>

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-slate-700">Activar recordatorios</span>
        <button
          onClick={s.toggleNotif}
          className={`w-12 h-7 rounded-full transition-colors relative ${s.notifEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
          aria-label={s.notifEnabled ? 'Desactivar recordatorios' : 'Activar recordatorios'}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-transform ${s.notifEnabled ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
      </div>

      {s.notifEnabled && (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-600">Avisar con antelación</span>
            <select
              value={s.notifAntelacion}
              onChange={(e) => s.changeNotifAntelacion(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={120}>2 horas</option>
            </select>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">Notificaciones del navegador</p>
              <p className="text-xs text-slate-500">
                {s.notifPermission === 'granted'
                  ? 'Permiso concedido'
                  : s.notifPermission === 'denied'
                    ? 'Permiso denegado (cambia en ajustes del navegador)'
                    : 'No solicitado'}
              </p>
            </div>
            {s.notifPermission !== 'granted' && s.notifPermission !== 'denied' && (
              <button
                onClick={s.requestNotifPermission}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
              >
                Permitir
              </button>
            )}
            {s.notifPermission === 'granted' && (
              <Check size={18} className="text-emerald-600 shrink-0" aria-hidden="true" />
            )}
          </div>
        </>
      )}
    </Section>
  );
}

export function PickSection({ s }) {
  return (
    <Section icon={Sparkles} title="Pick (asistente IA)" iconColor="text-purple-600" iconBg="bg-purple-50">
      <p className="text-xs text-slate-500 mb-4">
        Controla cuánto puede hablarte Pick sin que tú se lo pidas. Siempre responderá cuando le preguntes — esto solo
        afecta a sugerencias espontáneas.
      </p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Modo de proactividad de Pick">
        {[
          {
            value: 'off',
            title: 'Solo bajo petición',
            desc: 'Pick no propone nada. Responde solo cuando le escribes.',
          },
          {
            value: 'suggestions',
            title: 'Sugerencias suaves',
            desc: 'Pequeñas sugerencias en la pantalla actual (burbuja cerrable, no interrumpe).',
          },
          {
            value: 'nudges',
            title: 'Proactivo contextual',
            desc: 'Además, avisa cuando detecta algo útil (cambios sin guardar, partido sin alineación…).',
          },
        ].map((opt) => {
          const active = (s.form.proactivityMode || 'suggestions') === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => s.changeProactivityMode(opt.value)}
              className={`text-left border rounded-xl px-4 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 ${
                active
                  ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${
                    active ? 'border-purple-600 bg-purple-600' : 'border-slate-300 bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {active && <div className="w-full h-full rounded-full bg-white scale-[0.4]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${active ? 'text-purple-800' : 'text-slate-700'}`}>
                    {opt.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

export function DataSection({ s }) {
  return (
    <Section icon={Database} title="Mis datos" iconColor="text-emerald-600" iconBg="bg-emerald-50">
      <p className="text-xs text-slate-500 mb-4">
        Exporta todos tus datos (equipos, jugadores, entrenamientos, ejercicios y calendario) como copia de seguridad, o
        impórtalos desde un backup anterior. La importación añade sin borrar datos existentes.
      </p>

      <button
        onClick={s.handleExport}
        disabled={s.exporting}
        className="w-full flex items-center gap-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 px-4 rounded-xl transition disabled:opacity-60 text-sm"
      >
        <Download size={18} className="shrink-0" aria-hidden="true" />
        <div className="text-left">
          <p className="font-bold">{s.exporting ? 'Exportando...' : 'Exportar mis datos'}</p>
          <p className="text-xs font-normal text-emerald-600">Descarga un archivo .json con todo tu contenido</p>
        </div>
      </button>

      <button
        onClick={() => s.importInputRef.current?.click()}
        className="w-full flex items-center gap-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-3 px-4 rounded-xl transition text-sm mt-3"
      >
        <Upload size={18} className="shrink-0" aria-hidden="true" />
        <div className="text-left">
          <p className="font-bold">Importar datos</p>
          <p className="text-xs font-normal text-blue-600">Restaurar desde un backup .json de Pick&amp;Coach</p>
        </div>
      </button>
      <input ref={s.importInputRef} type="file" accept=".json" className="hidden" onChange={s.handleImportFile} />

      {s.importError && <p className="text-sm text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2">{s.importError}</p>}
    </Section>
  );
}

export function AccountSection({ s }) {
  return (
    <Section icon={Shield} title="Cuenta" iconColor="text-slate-600" iconBg="bg-slate-100">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">{s.emailDisplay}</p>
          </div>
        </div>

        {s.isAnonymous && !s.linkedOk && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Cuenta de invitado</p>
            <p className="text-xs text-amber-700 mb-3">
              Vincula tu cuenta con Google para no perder tus datos si cambias de dispositivo o navegador.
            </p>
            {s.linkError && <p className="text-xs text-red-600 mb-2">{s.linkError}</p>}
            <button
              onClick={s.handleLink}
              disabled={s.linkingGoogle}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-xl transition disabled:opacity-60"
            >
              <Link size={15} aria-hidden="true" /> {s.linkingGoogle ? 'Vinculando...' : 'Vincular con Google'}
            </button>
          </div>
        )}

        {s.linkedOk && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-700 text-sm font-semibold">
            <Check size={16} aria-hidden="true" /> Cuenta vinculada correctamente
          </div>
        )}

        <button
          onClick={s.handleLogout}
          className="flex items-center gap-3 text-slate-600 hover:text-red-600 font-semibold text-sm py-2 transition"
        >
          <LogOut size={16} aria-hidden="true" /> Cerrar sesión
        </button>
      </div>
    </Section>
  );
}

export function DangerZoneSection({ s }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border-b border-red-100">
        <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-red-600" aria-hidden="true" />
        </div>
        <div>
          <p className="font-bold text-red-700 text-sm">Zona peligrosa</p>
          <p className="text-xs text-red-500">Acciones irreversibles</p>
        </div>
      </div>
      <div className="px-5 py-4 flex flex-col gap-4">
        <div>
          <p className="text-sm text-slate-600 mb-3">
            Borra todos tus equipos, jugadores, entrenamientos, ejercicios, torneos y sesiones del calendario.
            <span className="font-semibold text-red-600"> Esta acción no se puede deshacer.</span>
          </p>
          <button
            onClick={() => s.setShowDeleteDataModal(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition"
          >
            <Trash2 size={15} aria-hidden="true" /> Borrar todos mis datos
          </button>
        </div>
      </div>
    </div>
  );
}
