import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, IconButton, CircularProgress, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Viewer, SceneRevealMode } from '@mkkellogg/gaussian-splats-3d';

interface SplatViewerProps {
  splatUrl: string;
  onClose?: () => void;
}

export const SplatViewer = ({ splatUrl, onClose }: SplatViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(async () => {
    if (viewerRef.current) {
      const viewer = viewerRef.current;
      viewerRef.current = null;
      try {
        await viewer.dispose();
      } catch {
        // Ignore cleanup errors
      }
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !splatUrl) return;

    let cancelled = false;

    const initViewer = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const viewer = new Viewer({
          rootElement: container,
          selfDrivenMode: true,
          useBuiltInControls: true,
          cameraUp: [0, 1, 0],
          initialCameraPosition: [0, 5, 10],
          initialCameraLookAt: [0, 0, 0],
          antialiased: true,
          sceneRevealMode: SceneRevealMode.Gradual,
          sharedMemoryForWorkers: false,
          gpuAcceleratedSort: true,
        });

        if (cancelled) {
          await viewer.dispose();
          return;
        }

        viewerRef.current = viewer;

        await viewer.addSplatScene(splatUrl, {
          showLoadingUI: false,
          progressiveLoad: true,
        }).promise;

        if (cancelled) return;

        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Fehler beim Laden der 3D-Szene';
        setError(message);
        setIsLoading(false);
      }
    };

    initViewer();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [splatUrl, cleanup]);

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Close button */}
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10000,
          width: 44,
          height: 44,
          backgroundColor: 'rgba(46, 46, 46, 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#FFFFFF',
          '&:hover': { backgroundColor: 'rgba(46, 46, 46, 0.85)' },
        }}
      >
        <CloseIcon />
      </IconButton>

      {/* Three.js container */}
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          '& canvas': {
            display: 'block',
            width: '100% !important',
            height: '100% !important',
          },
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            backgroundColor: 'rgba(10, 10, 10, 0.7)',
            zIndex: 10001,
            pointerEvents: 'none',
          }}
        >
          <CircularProgress size={48} sx={{ color: '#FFFFFF' }} />
          <Typography sx={{ color: '#FFFFFF80', fontSize: '14px' }}>
            3D-Szene wird geladen...
          </Typography>
        </Box>
      )}

      {/* Error state */}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '24px 32px',
            borderRadius: '20px',
            backgroundColor: 'rgba(46, 46, 46, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 10001,
          }}
        >
          <Typography sx={{ color: '#FF6B6B', fontSize: '14px', fontWeight: 600 }}>
            Fehler beim Laden
          </Typography>
          <Typography
            sx={{
              color: '#FFFFFF80',
              fontSize: '12px',
              textAlign: 'center',
              maxWidth: '300px',
            }}
          >
            {error}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
