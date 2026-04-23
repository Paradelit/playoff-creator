import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { ImportPreviewModal, DeleteDataModal, DeleteAccountModal } from '../components/settings/SettingsModals';
import {
  ProfileSection,
  ClubSection,
  RemindersSection,
  CopilotSection,
  DataSection,
  AccountSection,
  DangerZoneSection,
} from '../components/settings/SettingsSections';

export default function SettingsScreen() {
  const s = useSettings();

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-24">
      {/* Header */}
      <div className="bg-blue-950 px-5 pt-10 pb-6">
        <button
          onClick={() => s.navigate('/')}
          className="flex items-center gap-1.5 text-blue-400 hover:text-white text-sm font-medium transition mb-4"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Inicio
        </button>
        <h1 className="text-white text-2xl font-bold">Ajustes</h1>
        <p className="text-blue-400 text-sm mt-0.5">Perfil, club y configuración de la cuenta</p>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 flex flex-col gap-6">
        <ProfileSection s={s} />
        <ClubSection s={s} />
        <RemindersSection s={s} />
        <CopilotSection s={s} />
        <DataSection s={s} />
        <AccountSection s={s} />
        <DangerZoneSection s={s} />
        <div className="h-4" />
      </div>

      {/* ─── Modals ─── */}
      {s.importPreview && (
        <ImportPreviewModal
          importPreview={s.importPreview}
          setImportPreview={s.setImportPreview}
          importing={s.importing}
          handleConfirmImport={s.handleConfirmImport}
        />
      )}

      {s.showDeleteDataModal && (
        <DeleteDataModal
          setShowDeleteDataModal={s.setShowDeleteDataModal}
          deletingData={s.deletingData}
          handleDeleteData={s.handleDeleteData}
        />
      )}

      {s.showDeleteAccountModal && (
        <DeleteAccountModal
          navigate={s.navigate}
          deleteConfirmText={s.deleteConfirmText}
          setDeleteConfirmText={s.setDeleteConfirmText}
          deletingAccount={s.deletingAccount}
          setShowDeleteAccountModal={s.setShowDeleteAccountModal}
          handleDeleteAccount={s.handleDeleteAccount}
        />
      )}
    </div>
  );
}
