import { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FlipIcon from '@mui/icons-material/Flip';
import { SplatScene } from '../splat/SplatScene';

interface SplatViewerProps {
  splatUrl: string;
  collisionUrl?: string | null;
  onClose?: () => void;
}

const buttonSx = {
  position: 'absolute',
  top: 16,
  zIndex: 10000,
  width: 44,
  height: 44,
  backgroundColor: 'rgba(46, 46, 46, 0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  color: '#FFFFFF',
  '&:hover': { backgroundColor: 'rgba(46, 46, 46, 0.85)' },
} as const;

/** Full-screen splat viewer with close and flip buttons, used from the space and job windows. */
export const SplatViewer = ({ splatUrl, collisionUrl, onClose }: SplatViewerProps) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0a0a0a',
        zIndex: 9999,
      }}
    >
      <IconButton onClick={onClose} sx={{ ...buttonSx, right: 16 }}>
        <CloseIcon />
      </IconButton>
      <Tooltip title="Ansicht spiegeln">
        <IconButton onClick={() => setFlipped(f => !f)} sx={{ ...buttonSx, right: 68 }}>
          <FlipIcon />
        </IconButton>
      </Tooltip>
      <SplatScene splatUrl={splatUrl} collisionUrl={collisionUrl} flipped={flipped} />
    </Box>
  );
};
