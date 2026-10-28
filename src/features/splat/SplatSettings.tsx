import { useState } from 'react';
import { Box, Button, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import FlipIcon from '@mui/icons-material/Flip';
import TuneIcon from '@mui/icons-material/Tune';
import { useIsMobile } from '../../hooks/useIsMobile';
import { QUALITY_LABELS, SplatQuality } from './splatQuality';

interface SplatSettingsProps {
  flipped: boolean;
  onFlippedChange: (flipped: boolean) => void;
  quality: SplatQuality;
  onQualityChange: (quality: SplatQuality) => void;
}

const glassSx = {
  backgroundColor: 'rgba(46, 46, 46, 0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  color: '#FFFFFF',
  '&:hover': { backgroundColor: 'rgba(46, 46, 46, 0.85)' },
} as const;

/** Mirror button and quality picker shown over the splat background. */
export function SplatSettings({
  flipped,
  onFlippedChange,
  quality,
  onQualityChange,
}: SplatSettingsProps) {
  const isMobile = useIsMobile();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box
      sx={{
        position: 'absolute',
        // On phones the top edge belongs to the view switch.
        top: isMobile ? 64 : 16,
        right: 16,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Tooltip title="Ansicht spiegeln">
        <IconButton
          aria-label="Ansicht spiegeln"
          aria-pressed={flipped}
          onClick={() => onFlippedChange(!flipped)}
          sx={{
            ...glassSx,
            width: 40,
            height: 40,
            ...(flipped && { backgroundColor: 'rgba(255, 255, 255, 0.25)' }),
          }}
        >
          <FlipIcon />
        </IconButton>
      </Tooltip>
      <Button
        aria-label="Qualität"
        aria-haspopup="menu"
        startIcon={<TuneIcon />}
        onClick={event => setAnchor(event.currentTarget)}
        sx={{ ...glassSx, height: 40, borderRadius: '20px', px: 2, textTransform: 'none' }}
      >
        {QUALITY_LABELS[quality]}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {(Object.keys(QUALITY_LABELS) as SplatQuality[]).map(level => (
          <MenuItem
            key={level}
            selected={level === quality}
            onClick={() => {
              onQualityChange(level);
              setAnchor(null);
            }}
          >
            {QUALITY_LABELS[level]}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
