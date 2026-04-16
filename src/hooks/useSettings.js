import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  subscribeToProfile,
  saveProfile,
  uploadLogoClub,
  exportUserData,
  importUserData,
  deleteAllUserData,
} from '../services/settingsService';
import logger from '../utils/logger';

const EMPTY_PROFILE = {
  nombre: '',
  fechaNacimiento: '',
  dni: '',
  telefono: '',
  licencia: '',
  alergias: '',
  rol: 'Entrenador',
  autoAddToTeams: false,
  nombreClub: '',
  logoClub: '',
  proactivityMode: 'suggestions',
};

export { EMPTY_PROFILE };

export function useSettings() {
  const navigate = useNavigate();
  const { user, handleLogout, handleLinkGoogle, handleDeleteAuthAccount } = useAuth();
  const { db, appId, storage } = useFirebase();

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

  const [deletingData, setDeletingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  const importInputRef = useRef(null);

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifAntelacion, setNotifAntelacion] = useState(30);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToProfile(user.uid, db, appId, (data) => {
      const merged = { ...EMPTY_PROFILE, ...data };
      setForm(merged);
      if (data?.notifEnabled !== undefined) setNotifEnabled(data.notifEnabled);
      if (data?.notifAntelacion !== undefined) setNotifAntelacion(data.notifAntelacion);
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

  async function handleSaveClubName() {
    setSavingProfile(true);
    try {
      await saveProfile({ nombreClub: form.nombreClub }, { uid: user.uid, db, appId });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingLogo(true);
    try {
      const url = await uploadLogoClub(file, { uid: user.uid, storage, db, appId });
      setForm((f) => ({ ...f, logoClub: url }));
    } finally {
      setUploadingLogo(false);
    }
  }

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

  async function handleLink() {
    setLinkingGoogle(true);
    setLinkError('');
    try {
      await handleLinkGoogle();
      setLinkedOk(true);
    } catch {
      setLinkError('No se pudo vincular la cuenta. Inténtalo de nuevo.');
    } finally {
      setLinkingGoogle(false);
    }
  }

  async function handleDeleteData() {
    setDeletingData(true);
    try {
      await deleteAllUserData(user.uid, db, appId);
      setShowDeleteDataModal(false);
      setShowDeleteAccountModal(true);
    } catch (e) {
      logger.error('Error eliminando datos', e);
    } finally {
      setDeletingData(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'ELIMINAR') return;
    setDeletingAccount(true);
    try {
      await handleDeleteAuthAccount();
    } catch (e) {
      logger.error('Error eliminando cuenta de usuario', e);
      setDeletingAccount(false);
      setShowDeleteAccountModal(false);
    }
  }

  async function toggleNotif() {
    const next = !notifEnabled;
    setNotifEnabled(next);
    await saveProfile({ ...form, notifEnabled: next, notifAntelacion }, { uid: user.uid, db, appId });
  }

  async function changeNotifAntelacion(val) {
    setNotifAntelacion(val);
    await saveProfile({ ...form, notifEnabled, notifAntelacion: val }, { uid: user.uid, db, appId });
  }

  async function requestNotifPermission() {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  }

  async function changeProactivityMode(mode) {
    setForm((f) => ({ ...f, proactivityMode: mode }));
    await saveProfile({ proactivityMode: mode }, { uid: user.uid, db, appId });
  }

  const isAnonymous = user?.isAnonymous;
  const emailDisplay = user?.email || (isAnonymous ? 'Cuenta de invitado' : '—');

  return {
    navigate,
    user,
    form,
    setForm,
    savingProfile,
    profileSaved,
    handleSaveProfile,
    handleSaveClubName,
    // Logo
    uploadingLogo,
    logoInputRef,
    handleLogoUpload,
    // Export/Import
    exporting,
    importing,
    importPreview,
    setImportPreview,
    importError,
    importInputRef,
    handleExport,
    handleImportFile,
    handleConfirmImport,
    // Account
    isAnonymous,
    emailDisplay,
    linkingGoogle,
    linkError,
    linkedOk,
    handleLink,
    handleLogout,
    // Delete
    deletingData,
    deletingAccount,
    deleteConfirmText,
    setDeleteConfirmText,
    showDeleteDataModal,
    setShowDeleteDataModal,
    showDeleteAccountModal,
    setShowDeleteAccountModal,
    handleDeleteData,
    handleDeleteAccount,
    // Notifications
    notifEnabled,
    notifAntelacion,
    notifPermission,
    toggleNotif,
    changeNotifAntelacion,
    requestNotifPermission,
    // Copilot preferences
    changeProactivityMode,
  };
}
