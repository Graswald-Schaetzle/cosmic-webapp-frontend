import { createElement, CSSProperties, HTMLAttributes, DetailedHTMLProps } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { closeSpaceViewerWindow } from '../../store/modalSlice';
import { useGetJobOutputQuery } from '../../api/reconstruction/reconstructionApi';
import { SplatViewer } from '../reconstruction/SplatViewer';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeWorkIcon from '@mui/icons-material/HomeWork';

type ModelViewerProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  alt?: string;
  'camera-controls'?: boolean | string;
  'auto-rotate'?: boolean | string;
  ar?: boolean | string;
  style?: CSSProperties;
};

function UsdzViewer({ src, name }: { src: string; name: string }) {
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {createElement('model-viewer', {
        src,
        alt: name,
        'camera-controls': true,
        'auto-rotate': true,
        style: { width: '100%', height: '100%', background: 'transparent' },
      } as ModelViewerProps)}
    </Box>
  );
}

function NoModelPlaceholder({ name }: { name: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 2,
      }}
    >
      <HomeWorkIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 80 }} />
      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>{name}</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
        No 3D model available
      </Typography>
    </Box>
  );
}

export const SpaceViewerWindow = () => {
  const dispatch = useDispatch();
  const { isOpen, spaceName, modelUrl, jobId } = useSelector(
    (state: RootState) => state.modal.spaceViewerWindowModal
  );

  const { data: jobOutput, isLoading: outputLoading } = useGetJobOutputQuery(jobId!, {
    skip: !isOpen || jobId === null,
  });

  const handleClose = () => dispatch(closeSpaceViewerWindow());

  if (!isOpen) return null;

  // Determine which viewer to show
  const splatUrl = jobOutput?.splat_url ?? jobOutput?.spz_url ?? null;
  const showSplat = Boolean(splatUrl);
  const showUsdz = !showSplat && Boolean(modelUrl);

  if (showSplat) {
    return (
      <Box sx={{ position: 'fixed', inset: 0, zIndex: 11000 }}>
        {/* Back button over the full-screen splat viewer */}
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 11001,
            width: 44,
            height: 44,
            backgroundColor: 'rgba(46, 46, 46, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: '#FFFFFF',
            '&:hover': { backgroundColor: 'rgba(46, 46, 46, 0.85)' },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        {spaceName && (
          <Box
            sx={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 11001,
              backgroundColor: 'rgba(46, 46, 46, 0.6)',
              backdropFilter: 'blur(12px)',
              borderRadius: '20px',
              px: 2,
              py: 0.5,
            }}
          >
            <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
              {spaceName}
            </Typography>
          </Box>
        )}
        <SplatViewer splatUrl={splatUrl!} onClose={handleClose} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 11000,
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ color: '#fff', fontSize: '15px', fontWeight: 600, flex: 1 }}>
          {spaceName ?? 'Space'}
        </Typography>
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Viewer area */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {outputLoading && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <CircularProgress sx={{ color: '#fff' }} />
          </Box>
        )}

        {!outputLoading && showUsdz && <UsdzViewer src={modelUrl!} name={spaceName ?? 'Space'} />}

        {!outputLoading && !showSplat && !showUsdz && (
          <NoModelPlaceholder name={spaceName ?? 'Space'} />
        )}
      </Box>
    </Box>
  );
};
