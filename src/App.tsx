import { useState } from 'react';
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
import { SpacesWindow } from './features/spaces/SpacesWindow';
import { SpaceViewerWindow } from './features/spaces/SpaceViewerWindow';
import { NewLocationWindow } from './features/mattertag/NewLocationWindow';

import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material';

const fieldSx = { input: { color: '#fff' }, label: { color: '#aaa' } };

function LoginForm() {
  const { login, register, isLoading, error } = useAuth();
  const isReturningUser = Boolean(localStorage.getItem('cosmic_returning_user'));

  const [isSignUp, setIsSignUp] = useState(!isReturningUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      register(email, password, firstName, lastName);
    } else {
      login(email, password);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#1a1a2e',
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 4,
          background: '#16213e',
          borderRadius: 2,
          minWidth: 320,
        }}
      >
        <Typography variant="h5" sx={{ color: '#fff', mb: 1 }}>
          {isSignUp ? 'Konto erstellen' : 'Anmelden'}
        </Typography>

        {error && (
          <Typography sx={{ color: '#ff6b6b', fontSize: 14 }}>{error}</Typography>
        )}

        {isSignUp && (
          <>
            <TextField
              label="Vorname"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              variant="outlined"
              size="small"
              sx={fieldSx}
            />
            <TextField
              label="Nachname"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              variant="outlined"
              size="small"
              sx={fieldSx}
            />
          </>
        )}

        <TextField
          label="E-Mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          variant="outlined"
          size="small"
          sx={fieldSx}
        />
        <TextField
          label="Passwort"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          variant="outlined"
          size="small"
          sx={fieldSx}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={isLoading}
          sx={{ mt: 1 }}
        >
          {isLoading ? (
            <CircularProgress size={20} sx={{ color: '#fff' }} />
          ) : isSignUp ? (
            'Registrieren'
          ) : (
            'Anmelden'
          )}
        </Button>

        <Typography
          sx={{ color: '#aaa', fontSize: 13, textAlign: 'center', cursor: 'pointer' }}
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? 'Bereits registriert? Anmelden' : 'Noch kein Konto? Registrieren'}
        </Typography>
      </Box>
    </Box>
  );
}

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
    return <LoginForm />;
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

            <SpacesWindow />

            <SpaceViewerWindow />

            <NewLocationWindow />
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
            <AuthenticatedContent />
          </AuthProvider>
        }
      />
    </Routes>
  );
}
