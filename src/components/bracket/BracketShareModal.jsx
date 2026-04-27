import React, { useId } from 'react';
import { Share2, X, Copy, Check, Link } from 'lucide-react';
import Dialog from '../Dialog';

const LINK_ACCESS_NOTE =
  'Los enlaces requieren iniciar sesion en Pick&Coach. Tras entrar, el cuadro se abrira automaticamente.';

export default function BracketShareModal({
  sharingBracket,
  setSharingBracket,
  user,
  inviteEmail,
  setInviteEmail,
  invitePermission,
  setInvitePermission,
  copiedCode,
  setCopiedCode,
  handleAddInvite,
  handleUpdateShareConfig,
  handleRemoveInvite,
  shareUrlBase,
}) {
  const titleId = useId();
  const emailId = useId();
  const permId = useId();
  const linkAccessId = useId();

  if (!sharingBracket?.shareConfig) return null;

  const onClose = () => setSharingBracket(null);

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[calc(100vh-5.5rem)] sm:max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 my-auto shrink-0"
    >
      <div className="flex justify-between items-center mb-5">
        <h2 id={titleId} className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Share2 size={20} className="text-blue-600" aria-hidden="true" /> Compartir cuadro
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <label htmlFor={emailId} className="block text-sm font-semibold text-slate-600 mb-2">
        Invitar personas
      </label>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          id={emailId}
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddInvite()}
          placeholder="correo@ejemplo.com"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex gap-2">
          <label htmlFor={permId} className="sr-only">
            Nivel de permiso para la persona invitada
          </label>
          <select
            id={permId}
            value={invitePermission}
            onChange={(e) => setInvitePermission(e.target.value)}
            className="flex-1 sm:flex-none border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="view">Solo ver</option>
            <option value="edit">Puede editar</option>
          </select>
          <button
            type="button"
            onClick={handleAddInvite}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
          >
            Añadir
          </button>
        </div>
      </div>

      <p className="text-sm font-semibold text-slate-600 mb-2">Personas con acceso</p>
      <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1 list-none">
        <li className="flex items-center justify-between text-sm py-1">
          <div className="flex items-center gap-2 min-w-0">
            <div
              aria-hidden="true"
              className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs"
            >
              {(sharingBracket.shareConfig.ownerName || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-slate-700">
              {sharingBracket.shareConfig.ownerName} {sharingBracket.shareConfig.ownerId === user?.uid ? '(tú)' : ''}
            </span>
          </div>
          <span className="text-slate-400 text-xs shrink-0 ml-2">Propietario</span>
        </li>
        {Object.entries(sharingBracket.shareConfig.invites || {}).map(([email, perm]) => (
          <li key={email} className="flex items-center justify-between text-sm py-1">
            <div className="flex items-center gap-2 min-w-0">
              <div
                aria-hidden="true"
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 font-bold text-xs"
              >
                {email.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-slate-700">{email}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <label className="sr-only">Cambiar permiso de {email}</label>
              <select
                aria-label={`Permiso de ${email}`}
                value={perm}
                onChange={(e) =>
                  handleUpdateShareConfig({
                    invites: { ...sharingBracket.shareConfig.invites, [email]: e.target.value },
                  })
                }
                className="border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="view">Solo ver</option>
                <option value="edit">Puede editar</option>
              </select>
              <button
                type="button"
                onClick={() => handleRemoveInvite(email)}
                aria-label={`Revocar acceso de ${email}`}
                className="text-slate-300 hover:text-red-500 p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 rounded"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-100 pt-4">
        <label
          htmlFor={linkAccessId}
          className="block text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1.5"
        >
          <Link size={14} aria-hidden="true" /> Acceso con enlace
        </label>
        <select
          id={linkAccessId}
          value={sharingBracket.shareConfig.linkAccess}
          onChange={(e) => handleUpdateShareConfig({ linkAccess: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="none">Sin acceso por enlace; solo personas invitadas</option>
          <option value="view">Quien abra el enlace y entre en su cuenta puede ver</option>
          <option value="edit">Quien abra el enlace y entre en su cuenta puede editar</option>
        </select>
        <p className="text-xs text-slate-500 mb-3">{LINK_ACCESS_NOTE}</p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(
              `${shareUrlBase || window.location.origin + '/s'}/${sharingBracket.shareCode}`,
            );
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
          }}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          {copiedCode ? (
            <>
              <Check size={16} aria-hidden="true" /> ¡Enlace copiado!
            </>
          ) : (
            <>
              <Copy size={16} aria-hidden="true" /> Copiar enlace
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}
