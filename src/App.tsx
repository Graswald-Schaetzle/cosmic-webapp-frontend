import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import { Routes, Route } from 'react-router-dom';
import { MatterportProvider } from './contexts/MatterportContext';
import { TaskProvider } from './contexts/TaskContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './Layouts/Layout/Layout.tsx';
import { MatterportLayout } from './Layouts/MatterportLayout/MatterportLayout.tsx';
import { Menu } from './features/menu/Menu.tsx';
import { MatterTagWindow } from './features/mattertag/MatterTagWindow';
import { TaskWindow } from './features/task/TaskWindow.tsx';
import { DashboardWindow } from './features/dashboard/DashboardWindow';
import { TasksWindow } from './features/tasks/TasksWindow.tsx';
import { NewTaskWindow } from './features/tasks/NewTaskWindow';
import { ListWindow } from './features/list/ListWindow.tsx';
import { NewListWindow } from './features/tasks/NewListWindow.tsx';
import { DocumentsWindow } from './features/documents/DocumentWindow.tsx';
import { DocumentInfoWindow } from './features/documentInfo/DocumentInfoWindow.tsx';
import { AddDocumentWindow } from './features/documents/AddDocumentWindow.tsx';
import { NotificationWindow } from './features/notifications/NotificationWindow';
import { ObjectManagerWindow } from './features/objectManager/ObjectManagerWindow';
import { CalendarWindow } from './features/calendar/CalendarWindow';
import { ReconstructionWindow } from './features/reconstruction/ReconstructionWindow';

import { Box, CircularProgress, Typography } from '@mui/material';

// Component to handle authenticated content
const AuthenticatedContent = () => {
  const { isAuthenticated, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress sx={{ color: '#fff' }} />
        <Typography sx={{ color: '#fff' }}>Authenticating...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <Typography sx={{ color: '#ff6b6b', textAlign: 'center' }}>
          Authentication Error: {error}
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <Typography sx={{ color: '#fff' }}>Please sign in to continue</Typography>
      </Box>
    );
  }

  return (
    <MatterportProvider>
      <TaskProvider>
        <Layout>
          <MatterportLayout>
            <Menu />

            <DashboardWindow />

            <MatterTagWindow />

            <TaskWindow />

            <TasksWindow />

            <NewTaskWindow />

            <ListWindow />

            <NewListWindow />

            <DocumentsWindow />

            <DocumentInfoWindow />

            <AddDocumentWindow />

            <NotificationWindow />

            <ObjectManagerWindow />

            <CalendarWindow />

            <ReconstructionWindow />
          </MatterportLayout>
        </Layout>
      </TaskProvider>
    </MatterportProvider>
  );
};

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthProvider>
            <SignedIn>
              <AuthenticatedContent />
            </SignedIn>
            <SignedOut>
              <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <SignIn />
              </div>
            </SignedOut>
          </AuthProvider>
        }
      />
    </Routes>
  );
}
