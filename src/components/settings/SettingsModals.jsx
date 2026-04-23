import React, { useId } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import Dialog from '../Dialog';

export function ImportPreviewModal({ importPreview, setImportPreview, importing, handleConfirmImport }) {
  const titleId = useId();
  const descId = useId();
  return (
    <Dialog
      open
      onClose={() => setImportPreview(null)}
      labelledBy={titleId}
      describedBy={descId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"
    >
      <h3 id={titleId} className="text-lg font-bold text-slate-800 mb-1">
        Confirmar importación
      </h3>
      <p id={descId} className="text-slate-500 text-sm mb-4">
        Backup del{' '}
        <span className="font-semibold">{new Date(importPreview.exportDate).toLocaleDateString('es-ES')}</span>
      </p>
      <dl className="bg-slate-50 rounded-xl p-4 flex flex-col gap-2 mb-5 text-sm">
        <ImportCount label="Equipos" count={importPreview.teams?.length || 0} />
        <ImportCount label="Ejercicios" count={importPreview.exercises?.length || 0} />
        <ImportCount label="Sesiones calendario" count={importPreview.calendarSessions?.length || 0} />
        <ImportCount
          label="Entrenamientos"
          count={Object.values(importPreview.trainings || {}).reduce((a, b) => a + b.length, 0)}
        />
      </dl>
      <p className="text-xs text-slate-500 mb-4">Los datos se añadirán sin borrar tu contenido actual.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setImportPreview(null)}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirmImport}
          disabled={importing}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          {importing ? 'Importando...' : 'Importar'}
        </button>
      </div>
    </Dialog>
  );
}

export function DeleteDataModal({ setShowDeleteDataModal, deletingData, handleDeleteData }) {
  const titleId = useId();
  const descId = useId();
  return (
    <Dialog
      open
      onClose={() => setShowDeleteDataModal(false)}
      labelledBy={titleId}
      describedBy={descId}
      closeOnBackdrop={false}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0" aria-hidden="true">
          <AlertTriangle size={20} className="text-red-600" />
        </div>
        <h3 id={titleId} className="text-lg font-bold text-slate-800">
          ¿Borrar todos tus datos?
        </h3>
      </div>
      <p id={descId} className="text-slate-600 text-sm mb-4">
        Se eliminarán permanentemente todos tus equipos, jugadores, entrenamientos, ejercicios, torneos y sesiones del
        calendario.
        <span className="font-semibold text-red-600"> Esta acción no se puede deshacer.</span>
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setShowDeleteDataModal(false)}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleDeleteData}
          disabled={deletingData}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
        >
          {deletingData ? 'Eliminando...' : 'Borrar todo'}
        </button>
      </div>
    </Dialog>
  );
}

export function DeleteAccountModal({
  navigate,
  deleteConfirmText,
  setDeleteConfirmText,
  deletingAccount,
  setShowDeleteAccountModal,
  handleDeleteAccount,
}) {
  const titleId = useId();
  const descId = useId();
  const confirmId = useId();
  const onCancel = () => {
    setShowDeleteAccountModal(false);
    setDeleteConfirmText('');
    navigate('/');
  };
  return (
    <Dialog
      open
      onClose={onCancel}
      labelledBy={titleId}
      describedBy={descId}
      closeOnBackdrop={false}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <Check size={20} className="text-emerald-600" />
        </div>
        <h3 id={titleId} className="text-lg font-bold text-slate-800">
          Datos eliminados
        </h3>
      </div>
      <p id={descId} className="text-slate-600 text-sm mb-5">
        Todos tus datos han sido borrados. ¿Quieres eliminar también tu cuenta de usuario? Si la eliminas, tendrás que
        registrarte de nuevo para volver a usar la app.
      </p>
      <label htmlFor={confirmId} className="block text-xs font-bold text-slate-500 mb-2">
        Escribe <span className="text-red-600 font-black">ELIMINAR</span> para confirmar la eliminación de la cuenta:
      </label>
      <input
        id={confirmId}
        type="text"
        value={deleteConfirmText}
        onChange={(e) => setDeleteConfirmText(e.target.value)}
        placeholder="ELIMINAR"
        autoComplete="off"
        className="w-full border-2 border-slate-300 focus:border-red-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none mb-4 font-bold tracking-wide"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          No, mantener cuenta
        </button>
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleteConfirmText !== 'ELIMINAR' || deletingAccount}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
        >
          {deletingAccount ? 'Eliminando...' : 'Eliminar cuenta'}
        </button>
      </div>
    </Dialog>
  );
}

function ImportCount({ label, count }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-bold text-slate-800">{count}</dd>
    </div>
  );
}
