import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { IconButton, Tooltip } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useIsMobile } from '../../hooks/useIsMobile';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { logout } = useAuth();
  const isMobile = useIsMobile();

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {!isMobile && (
        <div className="absolute top-4 right-4 z-50">
          <Tooltip title="Sign out">
            <IconButton onClick={logout} size="small" sx={{ color: '#fff' }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      )}
      {children}
    </div>
  );
}
