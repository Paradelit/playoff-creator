/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

import { useAuth } from './AuthContext';
import { useFirebase } from './FirebaseContext';
import { subscribeToTeams } from '../services/teamsService';

import { useBracketSync } from '../hooks/useBracketSync';
import { useBracketEditor } from '../hooks/useBracketEditor';
import { useBracketCreation } from '../hooks/useBracketCreation';
import { useSharing } from '../hooks/useSharing';

const BracketContext = createContext(null);

export function BracketProvider({ initialShareCode, initialTeamId, onShareCodeConsumed, shareUrlBase, children }) {
  const { user, handleLogout: authLogout } = useAuth();
  const { db, appId } = useFirebase();
  const firebaseError = !db;

  // --- APP MODE ---
  const [appMode, setAppMode] = useState('loading');

  // --- COACH TEAMS ---
  const [coachTeams, setCoachTeams] = useState([]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeams(user.uid, db, appId, setCoachTeams);
  }, [user, db, appId]);

  // --- HOOKS ---
  const sync = useBracketSync({
    user,
    db,
    appId,
    initialShareCode,
    initialTeamId,
    onShareCodeConsumed,
    appMode,
    setAppMode,
  });
  const { brackets, setBrackets, activeBracketId, activeBracket, canEdit } = sync;

  const creation = useBracketCreation({
    user,
    db,
    appId,
    initialTeamId,
    setBrackets,
    setActiveBracketId: sync.setActiveBracketId,
    setAppMode,
  });

  const editor = useBracketEditor({
    user,
    db,
    appId,
    brackets,
    setBrackets,
    activeBracketId,
    activeBracket,
    canEdit,
    appMode,
    setErrorMsg: creation.setErrorMsg,
  });

  const sharing = useSharing({
    user,
    db,
    appId,
    brackets,
    setBrackets,
    activeBracket,
    appMode,
    mainRef: editor.mainRef,
  });

  // Cross-hook cleanup on appMode change
  useEffect(() => {
    editor.setShowMobileTools(false);
    sharing.setSharingBracket(null);
    editor.setShowResetModal(false);
    creation.setErrorMsg('');
    editor.setEditingBracketName(false);
    if (creation.fileInputBases?.current) creation.fileInputBases.current.value = '';
    if (creation.fileInputClasif?.current) creation.fileInputClasif.current.value = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode]);

  const handleLogout = async () => {
    setBrackets([]);
    await authLogout();
  };

  // --- CONTEXT VALUE ---
  const value = {
    // Auth
    user,
    handleLogout,
    firebaseError,
    // Firebase
    db,
    appId,
    // App mode
    appMode,
    setAppMode,
    // Brackets (from sync)
    brackets,
    setBrackets,
    activeBracketId,
    setActiveBracketId: sync.setActiveBracketId,
    activeBracket,
    canEdit,
    // Dashboard (from sync)
    dashboardSearch: sync.dashboardSearch,
    setDashboardSearch: sync.setDashboardSearch,
    dashboardSort: sync.dashboardSort,
    setDashboardSort: sync.setDashboardSort,
    bracketToDelete: sync.bracketToDelete,
    setBracketToDelete: sync.setBracketToDelete,
    confirmDelete: sync.confirmDelete,
    handleDeleteBracket: sync.handleDeleteBracket,
    handleExport: sync.handleExport,
    handleImport: sync.handleImport,
    handleLinkTeam: sync.handleLinkTeam,
    handleUnlinkTeam: sync.handleUnlinkTeam,
    fileInputImport: sync.fileInputImport,
    // Creation
    newBracketName: creation.newBracketName,
    setNewBracketName: creation.setNewBracketName,
    basesFile: creation.basesFile,
    setBasesFile: creation.setBasesFile,
    clasifFile: creation.clasifFile,
    setClasifFile: creation.setClasifFile,
    customPrompt: creation.customPrompt,
    setCustomPrompt: creation.setCustomPrompt,
    errorMsg: creation.errorMsg,
    setErrorMsg: creation.setErrorMsg,
    isProcessing: creation.isProcessing,
    processStatus: creation.processStatus,
    pendingBracket: creation.pendingBracket,
    setPendingBracket: creation.setPendingBracket,
    previewZoom: creation.previewZoom,
    setPreviewZoom: creation.setPreviewZoom,
    pendingTeamObj: creation.pendingTeamObj,
    handleProcessDocuments: creation.handleProcessDocuments,
    handleConfirmBracket: creation.handleConfirmBracket,
    fileInputBases: creation.fileInputBases,
    fileInputClasif: creation.fileInputClasif,
    // Editor
    zoom: editor.zoom,
    setZoom: editor.setZoom,
    showResetModal: editor.showResetModal,
    setShowResetModal: editor.setShowResetModal,
    confirmReset: editor.confirmReset,
    showMobileTools: editor.showMobileTools,
    setShowMobileTools: editor.setShowMobileTools,
    isProcessingResults: editor.isProcessingResults,
    isExportingImage: editor.isExportingImage,
    editingBracketName: editor.editingBracketName,
    setEditingBracketName: editor.setEditingBracketName,
    bracketNameInput: editor.bracketNameInput,
    setBracketNameInput: editor.setBracketNameInput,
    saveError: editor.saveError,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    handleUndo: editor.handleUndo,
    handleRedo: editor.handleRedo,
    handleScoreChange: editor.handleScoreChange,
    handleSorteoSelect: editor.handleSorteoSelect,
    handleSetMyTeam: editor.handleSetMyTeam,
    handleDownloadImage: editor.handleDownloadImage,
    handleResultsUpload: editor.handleResultsUpload,
    fileInputResults: editor.fileInputResults,
    mainRef: editor.mainRef,
    bracketExportRef: editor.bracketExportRef,
    remoteCursors: sharing.remoteCursors,
    // Sharing
    sharingBracket: sharing.sharingBracket,
    setSharingBracket: sharing.setSharingBracket,
    copiedCode: sharing.copiedCode,
    setCopiedCode: sharing.setCopiedCode,
    inviteEmail: sharing.inviteEmail,
    setInviteEmail: sharing.setInviteEmail,
    invitePermission: sharing.invitePermission,
    setInvitePermission: sharing.setInvitePermission,
    handleShare: sharing.handleShare,
    handleAddInvite: sharing.handleAddInvite,
    handleUpdateShareConfig: sharing.handleUpdateShareConfig,
    handleRemoveInvite: sharing.handleRemoveInvite,
    shareUrlBase,
    // Teams
    coachTeams,
  };

  return <BracketContext.Provider value={value}>{children}</BracketContext.Provider>;
}

export function useBracket() {
  const ctx = useContext(BracketContext);
  if (!ctx) throw new Error('useBracket must be used within BracketProvider');
  return ctx;
}
