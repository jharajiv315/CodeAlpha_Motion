import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext.tsx';
import { RealtimeProvider } from './contexts/RealtimeContext.tsx';
import { SearchProvider } from './contexts/SearchContext.tsx';
import { AuthPage } from './components/auth/AuthPage.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { PrismLogo } from './components/ui/PrismLogo.tsx';
import { api } from './lib/api.ts';

function MainContent() {
  const { user, loading } = useAuth();
  const { reloadWorkspaces } = useWorkspace();

  useEffect(() => {
    // Check if user arrived via invite token link ?invite=...
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    if (inviteToken && user) {
      api.workspaces.acceptInvite(inviteToken).then(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        reloadWorkspaces();
      }).catch((err) => {
        console.warn('Could not auto-accept invite:', err);
      });
    }
  }, [user, reloadWorkspaces]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F7F4EC] text-[#5D655A] text-[13.5px]">
        <div className="flex flex-col items-center gap-3">
          <PrismLogo size="md" />
          <span className="font-medium">Loading MOTION...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AppLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <RealtimeProvider>
          <SearchProvider>
            <MainContent />
          </SearchProvider>
        </RealtimeProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
