import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';

export function ImportPreviewModal({ importPreview, setImportPreview, importing, handleConfirmImport }) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      onClick={() => setImportPreview(null)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-800 mb-1">Confirmar importación</h3>
        <p className="text-slate-500 text-sm mb-4">
          Backup del{' '}
          <span className="font-semibold">{new Date(importPreview.exportDate).toLocaleDateString('es-ES')}</span>
        </p>
        <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-2 mb-5 text-sm">
          <ImportCount label="Equipos" count={importPreview.teams?.length || 0} />
          <ImportCount label="Ejercicios" count={importPreview.exercises?.length || 0} />
          <ImportCount label="Sesiones calendario" count={importPreview.calendarSessions?.length || 0} />
          <ImportCount
            label="Entrenamientos"
            count={Object.values(importPreview.trainings || {}).reduce((a, b) => a + b.length, 0)}
          />
        </div>
        <p className="text-xs text-slate-500 mb-4">Los datos se añadirán sin borrar tu contenido actual.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setImportPreview(null)}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={importing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 text-sm"
          >
            {importing ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteDataModal({ setShowDeleteDataModal, deletingData, handleDeleteData }) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      onClick={() => setShowDeleteDataModal(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">¿Borrar todos tus datos?</h3>
        </div>
        <p className="text-slate-600 text-sm mb-4">
          Se eliminarán permanentemente todos tus equipos, jugadores, entrenamientos, ejercicios, torneos y sesiones del
          calendario.
          <span className="font-semibold text-red-600"> Esta acción no se puede deshacer.</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteDataModal(false)}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleDeleteData}
            disabled={deletingData}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 text-sm"
          >
            {deletingData ? 'Eliminando...' : 'Borrar todo'}
          </button>
        </div>
      </div>
    </div>
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
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <Check size={20} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Datos eliminados</h3>
        </div>
        <p className="text-slate-600 text-sm mb-5">
          Todos tus datos han sido borrados. ¿Quieres eliminar también tu cuenta de usuario? Si la eliminas, tendrás que
          registrarte de nuevo para volver a usar la app.
        </p>
        <p className="text-xs font-bold text-slate-500 mb-2">
          Escribe <span className="text-red-600 font-black">ELIMINAR</span> para confirmar la eliminación de la cuenta:
        </p>
        <input
          type="text"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="ELIMINAR"
          className="w-full border-2 border-slate-300 focus:border-red-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none mb-4 font-bold tracking-wide"
        />
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowDeleteAccountModal(false);
              setDeleteConfirmText('');
              navigate('/');
            }}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
          >
            No, mantener cuenta
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirmText !== 'ELIMINAR' || deletingAccount}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 text-sm"
          >
            {deletingAccount ? 'Eliminando...' : 'Eliminar cuenta'}
          </button>
        </div>
      </div>
    </div>
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
