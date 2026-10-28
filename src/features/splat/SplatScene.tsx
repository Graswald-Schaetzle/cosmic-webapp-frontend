import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SparkRenderer, SplatMesh, SplatFileType } from '@sparkjsdev/spark';
import { LocationItem } from '../../api/locationApi/locationApi';
import { useIsMobile } from '../../hooks/useIsMobile';
import { CeilingCut, ceilingCutHeight } from './ceilingCut';
import { SplatQuality, readEnvironment, resolveSource } from './splatQuality';
import { VirtualJoystick } from './VirtualJoystick';
import { WalkControls } from './WalkControls';
import {
  Collider,
  createCollider,
  findStartSpot,
  mostOpenYaw,
  raycastCollider,
} from './walkPhysics';

/** Same hold time and tolerance as the Matterport "hold still to add a tag" gesture. */
export const DWELL_MS = 3000;
export const DWELL_MOVE_PX = 15;
const MARKER_PICK_RADIUS_PX = 28;

export type ViewMode = 'walk' | 'orbit' | 'dollhouse';

/** Give up waiting for streamed splats to report their extent and frame an assumed 10 m room. */
const BOUNDS_TIMEOUT_MS = 15000;

// Signed download URLs carry a query string (?X-Goog-Signature=...), so the file extension has
// to be read from the URL path. Unknown extensions are left to Spark's content detection.
export const getSplatFileType = (url: string): SplatFileType | undefined => {
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

const TAG_COLORS = { room: '#FFA600', object: '#3380FF' } as const;

function makeMarkerTexture(color: string): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,20,20,0.55)';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface Marker {
  location: LocationItem;
  sprite: THREE.Sprite;
  visible: boolean;
}

interface SplatSceneProps {
  /** The regular (small) splat file. Optional when only a streamable file exists. */
  splatUrl?: string | null;
  /** Streamable level-of-detail version (.rad) of a large scene. */
  streamUrl?: string | null;
  quality?: SplatQuality;
  /** Optional low-poly collision mesh (glb). Without it the camera flies through walls. */
  collisionUrl?: string | null;
  /** Rotate the splat 180 degrees about X (for scenes exported upside down). */
  flipped?: boolean;
  tags?: LocationItem[];
  onTagClick?: (location: LocationItem) => void;
  /** Called when the user confirms the "+" shown after holding still at a spot. */
  onPlaceTag?: (position: { x: number; y: number; z: number }) => void;
  onLoadingChange?: (loading: boolean) => void;
}

interface Indicator {
  x: number;
  y: number;
  point: THREE.Vector3;
}

export const SplatScene = ({
  splatUrl,
  streamUrl,
  quality = 'auto',
  collisionUrl,
  flipped = false,
  tags = [],
  onTagClick,
  onPlaceTag,
  onLoadingChange,
}: SplatSceneProps) => {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const splatRef = useRef<SplatMesh | null>(null);
  const sparkRef = useRef<SparkRenderer | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const dollhouseRef = useRef<{ enter: () => void; leave: () => void; refresh: () => void } | null>(
    null
  );
  const sceneRef = useRef<THREE.Scene | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const walkRef = useRef<WalkControls | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const modeRef = useRef<ViewMode>('orbit');
  const callbacks = useRef({ onTagClick, onPlaceTag, onLoadingChange });
  callbacks.current = { onTagClick, onPlaceTag, onLoadingChange };

  // When streaming fails the regular file is used instead, if there is one.
  const [failedStreamUrl, setFailedStreamUrl] = useState<string | null>(null);
  const usableStreamUrl = streamUrl && streamUrl !== failedStreamUrl ? streamUrl : null;
  const source = useMemo(
    () =>
      resolveSource(quality, { splatUrl, streamUrl: usableStreamUrl }, readEnvironment(isMobile)),
    [quality, splatUrl, usableStreamUrl, isMobile]
  );
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;
  const sourceUrl = source?.url ?? null;
  const streaming = source?.streaming ?? false;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCollider, setHasCollider] = useState(false);
  const [mode, setModeState] = useState<ViewMode>('orbit');
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [showHint, setShowHint] = useState(true);

  const applyMode = useCallback((next: ViewMode) => {
    const walk = walkRef.current;
    const orbit = orbitRef.current;
    if (!walk || !orbit) return;
    const camera = orbit.object as THREE.PerspectiveCamera;
    if (modeRef.current === 'dollhouse' && next !== 'dollhouse') dollhouseRef.current?.leave();
    modeRef.current = next;
    if (next === 'walk') {
      orbit.enabled = false;
      walk.enabled = true;
      walk.syncFromCamera();
      walk.placeAt(camera.position);
      camera.up.set(0, 1, 0);
    } else if (next === 'dollhouse') {
      walk.enabled = false;
      orbit.enabled = true;
      dollhouseRef.current?.enter();
    } else {
      walk.enabled = false;
      orbit.enabled = true;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      orbit.target.copy(camera.position).addScaledVector(direction, 3);
      orbit.update();
    }
    setModeState(next);
    setIndicator(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !sourceUrl) return;
    const { pixelRatio, lodSplatScale } = sourceRef.current!;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setHasCollider(false);
    callbacks.current.onLoadingChange?.(true);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(pixelRatio);
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.05,
      500
    );
    camera.position.set(0, 5, 10);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbitRef.current = orbit;

    const raycaster = new THREE.Raycaster();
    let collider: Collider | null = null;

    const pointerToRay = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray;
    };

    const pickPoint = (clientX: number, clientY: number): THREE.Vector3 | null => {
      if (!collider) return null;
      const ray = pointerToRay(clientX, clientY);
      return raycastCollider(collider, ray.origin, ray.direction);
    };

    const projectToClient = (point: THREE.Vector3) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const p = point.clone().project(camera);
      return {
        x: rect.left + ((p.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - p.y) / 2) * rect.height,
        inFront: p.z < 1,
      };
    };

    const handleTap = (clientX: number, clientY: number) => {
      setIndicator(null);
      let nearest: Marker | null = null;
      let nearestDistance = MARKER_PICK_RADIUS_PX;
      for (const marker of markersRef.current) {
        if (!marker.visible) continue;
        const screen = projectToClient(marker.sprite.position);
        if (!screen.inFront) continue;
        const distance = Math.hypot(screen.x - clientX, screen.y - clientY);
        if (distance < nearestDistance) {
          nearest = marker;
          nearestDistance = distance;
        }
      }
      if (nearest) {
        callbacks.current.onTagClick?.(nearest.location);
        return;
      }
      if (modeRef.current === 'walk') {
        const point = pickPoint(clientX, clientY);
        if (point) walk.walkTo(point);
      }
    };

    const walk = new WalkControls(camera, renderer.domElement, { onTap: handleTap });
    walk.enabled = false;
    walkRef.current = walk;

    // "Hold still to place a tag": the pointer rests for DWELL_MS without moving or walking.
    let dwellTimer: ReturnType<typeof setTimeout> | null = null;
    let dwellAnchor = { x: 0, y: 0 };
    let touchDown = false;
    const clearDwell = () => {
      if (dwellTimer) clearTimeout(dwellTimer);
      dwellTimer = null;
    };
    const startDwell = (x: number, y: number) => {
      clearDwell();
      dwellAnchor = { x, y };
      dwellTimer = setTimeout(() => {
        if (walk.isActive || modeRef.current === 'dollhouse') return;
        const point = pickPoint(dwellAnchor.x, dwellAnchor.y);
        if (point) {
          const rect = renderer.domElement.getBoundingClientRect();
          setIndicator({ x: dwellAnchor.x - rect.left, y: dwellAnchor.y - rect.top, point });
        }
      }, DWELL_MS);
    };
    const onDwellMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' && !touchDown) return;
      const moved = Math.hypot(event.clientX - dwellAnchor.x, event.clientY - dwellAnchor.y);
      if (moved > DWELL_MOVE_PX) {
        setIndicator(null);
        startDwell(event.clientX, event.clientY);
      }
    };
    const onDwellDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') touchDown = true;
      setIndicator(null);
      startDwell(event.clientX, event.clientY);
    };
    const onDwellUp = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        touchDown = false;
        clearDwell();
      }
    };
    const dom = renderer.domElement;
    dom.addEventListener('pointermove', onDwellMove);
    dom.addEventListener('pointerdown', onDwellDown);
    dom.addEventListener('pointerup', onDwellUp);
    dom.addEventListener('pointercancel', onDwellUp);
    dom.addEventListener('pointerleave', clearDwell);

    const spark = new SparkRenderer({
      renderer,
      ...(streaming ? { enableLod: true, lodSplatScale } : {}),
    });
    sparkRef.current = spark;
    scene.add(spark);
    const splat = streaming
      ? new SplatMesh({ url: sourceUrl, fileType: SplatFileType.RAD, paged: true })
      : new SplatMesh({ url: sourceUrl, fileType: getSplatFileType(sourceUrl) });
    splat.quaternion.set(flippedRef.current ? 1 : 0, 0, 0, flippedRef.current ? 0 : 1);
    splatRef.current = splat;
    scene.add(splat);

    let colliderBox: THREE.Box3 | null = null;
    const collisionPromise: Promise<Collider | null> = collisionUrl
      ? new GLTFLoader()
          .loadAsync(collisionUrl)
          .then(gltf => {
            colliderBox = new THREE.Box3().setFromObject(gltf.scene);
            return createCollider(gltf.scene);
          })
          .catch(err => {
            console.warn('Collision mesh unavailable, walking without collision:', err);
            return null;
          })
      : Promise.resolve(null);

    // World-space extent of the scene. The collision mesh is the reliable source for streamed
    // scenes, where the splats only cover what has been fetched so far.
    const sceneBounds = (): THREE.Box3 | null => {
      const fromCollider = colliderBox && !colliderBox.isEmpty() ? colliderBox : null;
      if (streaming && fromCollider) return fromCollider;
      splat.updateMatrixWorld(true);
      const box = splat.getBoundingBox(true).applyMatrix4(splat.matrixWorld);
      return box.isEmpty() || !Number.isFinite(box.min.x) ? fromCollider : box;
    };

    // Dollhouse: look down on the scene from above with the ceiling cut away.
    const ceilingCut = new CeilingCut();
    const dollhouse = {
      refresh: () => {
        const box = sceneBounds();
        if (box) ceilingCut.setHeight(ceilingCutHeight(box));
      },
      enter: () => {
        const box = sceneBounds();
        if (!box) return;
        dollhouse.refresh();
        scene.add(ceilingCut.edit);
        const center = box.getCenter(new THREE.Vector3());
        const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.5);
        camera.up.set(0, 1, 0);
        camera.far = Math.max(camera.far, radius * 20);
        camera.updateProjectionMatrix();
        orbit.maxPolarAngle = Math.PI / 2 - 0.1;
        orbit.target.copy(center);
        camera.position.set(center.x, box.max.y + radius * 1.4, center.z + radius * 0.15);
        orbit.update();
      },
      leave: () => {
        scene.remove(ceilingCut.edit);
        orbit.maxPolarAngle = Math.PI;
      },
    };
    dollhouseRef.current = dollhouse;

    const finishLoading = () => {
      setIsLoading(false);
      callbacks.current.onLoadingChange?.(false);
    };

    const frameScene = (box: THREE.Box3, loadedCollider: Collider | null) => {
      collider = loadedCollider;
      walk.collider = loadedCollider;
      setHasCollider(Boolean(loadedCollider));

      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.5);
      const spot = loadedCollider ? findStartSpot(loadedCollider) : null;
      if (spot && loadedCollider) {
        camera.position.set(spot.x, spot.y + 1.6, spot.z);
        walk.syncFromCamera();
        walk.yaw = mostOpenYaw(loadedCollider, camera.position);
        camera.quaternion.setFromEuler(new THREE.Euler(0, walk.yaw, 0, 'YXZ'));
        orbit.target.copy(center);
        applyMode('walk');
      } else {
        orbit.target.copy(center);
        camera.position.copy(center).add(new THREE.Vector3(0, radius * 0.6, radius * 1.6));
        camera.far = radius * 100;
        camera.updateProjectionMatrix();
        orbit.update();
        applyMode('orbit');
      }
      if (new URLSearchParams(window.location.search).has('splatdebug')) {
        (window as unknown as Record<string, unknown>).__splat = {
          camera,
          walk,
          scene,
          getMode: () => modeRef.current,
          pickPoint,
          markers: () =>
            markersRef.current.map(m => ({ id: m.location.location_id, visible: m.visible })),
        };
      }
      finishLoading();
    };

    // Streamed splats report their extent only once the first chunks are in; keep asking.
    let pendingFrame: { collider: Collider | null; since: number; lastTry: number } | null = null;

    Promise.all([splat.initialized, collisionPromise])
      .then(([, loadedCollider]) => {
        if (cancelled) return;
        const box = sceneBounds();
        if (box) frameScene(box, loadedCollider);
        else pendingFrame = { collider: loadedCollider, since: performance.now(), lastTry: 0 };
      })
      .catch(err => {
        if (cancelled) return;
        if (streaming && splatUrl) {
          console.warn('Streaming the scene failed, loading the regular file instead:', err);
          setFailedStreamUrl(sourceUrl);
          return;
        }
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der 3D-Szene');
        finishLoading();
      });

    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = container;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    const toMarker = new THREE.Vector3();
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      if (pendingFrame) {
        const now = performance.now();
        if (now - pendingFrame.lastTry > 250) {
          pendingFrame.lastTry = now;
          const box =
            sceneBounds() ??
            (now - pendingFrame.since > BOUNDS_TIMEOUT_MS
              ? new THREE.Box3(new THREE.Vector3(-5, -2, -5), new THREE.Vector3(5, 3, 5))
              : null);
          if (box) {
            const frame = pendingFrame;
            pendingFrame = null;
            frameScene(box, frame.collider);
          }
        }
      }
      if (modeRef.current === 'walk') walk.update(dt);
      else orbit.update();

      // Hide markers that are behind walls.
      for (const marker of markersRef.current) {
        let visible = true;
        if (collider && modeRef.current !== 'dollhouse') {
          toMarker.subVectors(marker.sprite.position, camera.position);
          const distance = toMarker.length();
          const hit = raycastCollider(collider, camera.position, toMarker, distance - 0.15);
          visible = !hit;
        }
        marker.visible = visible;
        marker.sprite.visible = visible;
      }
      renderer.render(scene, camera);
    });

    return () => {
      cancelled = true;
      clearDwell();
      dom.removeEventListener('pointermove', onDwellMove);
      dom.removeEventListener('pointerdown', onDwellDown);
      dom.removeEventListener('pointerup', onDwellUp);
      dom.removeEventListener('pointercancel', onDwellUp);
      dom.removeEventListener('pointerleave', clearDwell);
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      walk.dispose();
      orbit.dispose();
      for (const marker of markersRef.current) {
        marker.sprite.material.map?.dispose();
        marker.sprite.material.dispose();
      }
      markersRef.current = [];
      splatRef.current = null;
      sparkRef.current = null;
      rendererRef.current = null;
      dollhouseRef.current = null;
      scene.remove(ceilingCut.edit);
      sceneRef.current = null;
      walkRef.current = null;
      orbitRef.current = null;
      scene.remove(splat);
      splat.dispose();
      scene.remove(spark);
      spark.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      if ((window as unknown as Record<string, unknown>).__splat) {
        delete (window as unknown as Record<string, unknown>).__splat;
      }
    };
  }, [sourceUrl, streaming, splatUrl, collisionUrl, applyMode]);

  // Splats exported from some pipelines are upside down; let the user flip them.
  useEffect(() => {
    splatRef.current?.quaternion.set(flipped ? 1 : 0, 0, 0, flipped ? 0 : 1);
    splatRef.current?.updateMatrixWorld(true);
    // The dollhouse cut follows the scene's top, which moves when the scene is mirrored.
    if (modeRef.current === 'dollhouse') dollhouseRef.current?.enter();
  }, [flipped, isLoading]);

  // Quality changes between files that need no reload only adjust the render settings.
  useEffect(() => {
    if (!source) return;
    rendererRef.current?.setPixelRatio(source.pixelRatio);
    if (sparkRef.current && source.streaming) sparkRef.current.lodSplatScale = source.lodSplatScale;
  }, [source]);

  // Keep tag markers in sync with the location list.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (const marker of markersRef.current) {
      scene.remove(marker.sprite);
      marker.sprite.material.map?.dispose();
      marker.sprite.material.dispose();
    }
    const textures = {
      room: makeMarkerTexture(TAG_COLORS.room),
      object: makeMarkerTexture(TAG_COLORS.object),
    };
    markersRef.current = tags
      .filter(tag => Number.isFinite(Number(tag.x)) && Number.isFinite(Number(tag.z)))
      .map(location => {
        const material = new THREE.SpriteMaterial({
          map: textures[location.tag_type === 'room' ? 'room' : 'object'],
          depthTest: false,
          transparent: true,
          sizeAttenuation: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.05, 0.05, 1);
        sprite.renderOrder = 999;
        sprite.position.set(Number(location.x), Number(location.y), Number(location.z));
        scene.add(sprite);
        return { location, sprite, visible: true };
      });
    // Textures are shared per type; dispose them with the markers on the next sync.
  }, [tags, isLoading]);

  // Hide the control hint after a few seconds.
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => setShowHint(false), 9000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />

      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            backgroundColor: 'rgba(10, 10, 10, 0.7)',
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          <CircularProgress size={48} sx={{ color: '#FFFFFF' }} />
          <Typography sx={{ color: '#FFFFFF80', fontSize: '14px' }}>
            3D-Szene wird geladen...
          </Typography>
        </Box>
      )}

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
            zIndex: 30,
          }}
        >
          <Typography sx={{ color: '#FF6B6B', fontSize: '14px', fontWeight: 600 }}>
            Fehler beim Laden
          </Typography>
          <Typography
            sx={{ color: '#FFFFFF80', fontSize: '12px', textAlign: 'center', maxWidth: '300px' }}
          >
            {error}
          </Typography>
        </Box>
      )}

      {indicator && (
        <Box
          data-testid="tag-indicator"
          onClick={() => {
            onPlaceTag?.({ x: indicator.point.x, y: indicator.point.y, z: indicator.point.z });
            setIndicator(null);
          }}
          sx={{
            position: 'absolute',
            left: indicator.x,
            top: indicator.y,
            transform: 'translate(-50%, -50%)',
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            border: '2px solid rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 24,
            fontWeight: 300,
            cursor: 'pointer',
            zIndex: 25,
            userSelect: 'none',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            animation: 'splatDwellPulse 1.2s ease-in-out infinite',
            '@keyframes splatDwellPulse': {
              '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
              '50%': { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 0.7 },
            },
          }}
        >
          +
        </Box>
      )}

      {!isLoading && !error && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_, next: ViewMode | null) => next && applyMode(next)}
          sx={{
            position: 'absolute',
            // On phones the bottom-left corner belongs to the joystick, so the switch goes on top.
            ...(isMobile ? { top: 16 } : { bottom: 24 }),
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            backgroundColor: 'rgba(46, 46, 46, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '20px',
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.7)',
              border: 'none',
              borderRadius: '20px',
              px: isMobile ? 1.5 : 2,
              whiteSpace: 'nowrap',
              textTransform: 'none',
              '&.Mui-selected': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.2)' },
            },
          }}
        >
          <ToggleButton value="walk" aria-label="Gehen">
            Gehen
          </ToggleButton>
          <ToggleButton value="orbit" aria-label="Umschauen">
            Umschauen
          </ToggleButton>
          <ToggleButton value="dollhouse" aria-label="Von oben">
            Von oben
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      {!isLoading && !error && mode === 'walk' && isMobile && (
        <VirtualJoystick onChange={(x, y) => walkRef.current?.moveInput.set(x, y)} />
      )}

      {!isLoading && !error && showHint && (
        <Typography
          sx={{
            position: 'absolute',
            top: isMobile ? 64 : 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            px: 2,
            py: 0.75,
            borderRadius: '16px',
            backgroundColor: 'rgba(46, 46, 46, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 12,
            textAlign: 'center',
            maxWidth: 'calc(100% - 32px)',
            pointerEvents: 'none',
          }}
        >
          {mode === 'orbit'
            ? 'Ziehen: drehen · Mausrad/Pinch: zoomen'
            : mode === 'dollhouse'
              ? 'Ansicht von oben ohne Decke · Ziehen: drehen · Mausrad/Pinch: zoomen'
              : isMobile
                ? 'Stick: gehen · Wischen: umsehen · Tippen: hingehen · Halten: Ort anlegen'
                : `WASD: gehen (Shift: schneller) · Ziehen: umsehen · Klick: hingehen · ${DWELL_MS / 1000} s ruhen: Ort anlegen${hasCollider ? '' : ' · ohne Kollision'}`}
        </Typography>
      )}
    </Box>
  );
};
