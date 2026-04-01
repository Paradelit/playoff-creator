import React from 'react';
import { BracketProvider, useBracket } from './contexts/BracketContext';
import { teamDisplayName } from './screens/TeamsScreen';

import LoadingScreen from './screens/LoadingScreen';
import DashboardScreen from './screens/DashboardScreen';
import UploadScreen from './screens/UploadScreen';
import PreviewScreen from './screens/PreviewScreen';
import BracketScreen from './screens/BracketScreen';

function PlayoffRouter() {
  const { appMode, activeBracket, pendingBracket, pendingTeamObj } = useBracket();

  if (appMode === 'loading') return <LoadingScreen />;
  if (appMode === 'dashboard') return <DashboardScreen />;
  if (appMode === 'upload')
    return <UploadScreen pendingTeamName={pendingTeamObj ? teamDisplayName(pendingTeamObj) : null} />;
  if (appMode === 'preview' && pendingBracket) return <PreviewScreen />;
  if (!activeBracket) return <LoadingScreen />;
  return <BracketScreen />;
}

export default function PlayoffCreatorModule({ initialShareCode, initialTeamId, onShareCodeConsumed, shareUrlBase }) {
  return (
    <BracketProvider
      initialShareCode={initialShareCode}
      initialTeamId={initialTeamId}
      onShareCodeConsumed={onShareCodeConsumed}
      shareUrlBase={shareUrlBase}
    >
      <PlayoffRouter />
    </BracketProvider>
  );
}
