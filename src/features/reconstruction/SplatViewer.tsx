import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, CircularProgress, Typography, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FlipIcon from '@mui/icons-material/Flip';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh, SplatFileType } from '@sparkjsdev/spark';

// Signed download URLs carry a query string (?X-Goog-Signature=...), so the file extension has
// to be read from the URL path. Unknown extensions are left to Spark's content detection.
const getSplatFileType = (url: string): SplatFileType | undefined => {
  let path = url;
  try {
    path = new URL(url, window.location.href).pathname;
  } catch {
    // keep the raw string
  }
  path = path.toLowerCase();
  if (path.endsWith('.spz')) return SplatFileType.SPZ;
  if (path.endsWith('.ply')) return SplatFileType.PLY;
  if (path.endsWith('.ksplat')) return SplatFileType.KSPLAT;
  if (path.endsWith('.splat')) return SplatFileType.SPLAT;
  if (path.endsWith('.sog')) return SplatFileType.PCSOGSZIP;
  return undefined;
};

interface SplatViewerProps {
  splatUrl: string;
  onClose?: () => void;
}

export const SplatViewer = ({ splatUrl, onClose }: SplatViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const splatRef = useRef<SplatMesh | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !splatUrl) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.01,
      1000
    );
    camera.up.set(0, 1, 0);
    camera.position.set(0, 5, 10);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    const spark = new SparkRenderer({ renderer });
    scene.add(spark);

    const splat = new SplatMesh({ url: splatUrl, fileType: getSplatFileType(splatUrl) });
    splatRef.current = splat;
    scene.add(splat);

    splat.initialized
      .then(() => {
        if (cancelled) return;
        // Frame the camera around the loaded scene.
        const box = splat.getBoundingBox(true);
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.5);
          controls.target.copy(center);
          camera.position.copy(center).add(new THREE.Vector3(0, radius * 0.6, radius * 1.6));
          camera.far = radius * 100;
          camera.updateProjectionMatrix();
          controls.update();
        }
        setIsLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der 3D-Szene');
        setIsLoading(false);
      });

    const handleResize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      splatRef.current = null;
      scene.remove(splat);
      splat.dispose();
      scene.remove(spark);
      spark.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [splatUrl]);

  // Splats exported from some pipelines (e.g. COLMAP/3DGS PLY) are upside down; let the user flip.
  useEffect(() => {
    splatRef.current?.quaternion.set(flipped ? 1 : 0, 0, 0, flipped ? 0 : 1);
  }, [flipped, isLoading]);

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

      {/* Flip orientation */}
      <Tooltip title="Ansicht spiegeln">
        <IconButton
          onClick={() => setFlipped(f => !f)}
          sx={{
            position: 'absolute',
            top: 16,
            right: 68,
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
          <FlipIcon />
        </IconButton>
      </Tooltip>

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
