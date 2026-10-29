import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SparkRenderer, SplatMesh, SplatFileType } from '@sparkjsdev/spark';
import { LocationItem } from '../../api/locationApi/locationApi';
import { SplatView } from '../../api/reconstruction/reconstructionApi';
import { SpaceFrame, applyPlacementTo, placementToMatrix, resolvePlacement } from './spaceFrame';
import { useIsMobile } from '../../hooks/useIsMobile';
import { FloorPlanMap, MapPose, MapTag } from './FloorPlanMap';
import { FloorPlan, buildFloorPlan } from './floorPlan';
import { SpaceMinimap } from './minimapImage';
import { VirtualJoystick } from './VirtualJoystick';
import { WalkControls } from './WalkControls';
import {
  Collider,
  createCollider,
  findStartSpot,
  floorHeightBelow,
  mostOpenYaw,
  raycastCollider,
} from './walkPhysics';

/** Same hold time and tolerance as the Matterport "hold still to add a tag" gesture. */
export const DWELL_MS = 3000;
export const DWELL_MOVE_PX = 15;
const MARKER_PICK_RADIUS_PX = 28;

export type ViewMode = 'walk' | 'orbit';

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
const CALIBRATION_COLOR = '#00D26A';

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
  splatUrl: string;
  /** Optional low-poly collision mesh (glb). Without it the camera flies through walls. */
  collisionUrl?: string | null;
  /** Rotate the splat 180 degrees about X (for scenes exported upside down). */
  flipped?: boolean;
  /** Saved start camera of the space (and, for spaces without a frame, the legacy rotation). */
  view?: SplatView | null;
  /** How the splat and collision mesh sit in the space frame. */
  frame?: SpaceFrame | null;
  /** Pre-rendered minimap image; without it the minimap is cut from the collision mesh. */
  minimap?: SpaceMinimap | null;
  /**
   * While set, taps on the model pick points for the calibration instead of walking, and the
   * points are shown as green markers. Needs a collision mesh to pick on.
   */
  calibration?: { points: THREE.Vector3[]; onPick: (point: THREE.Vector3) => void } | null;
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
  collisionUrl,
  flipped = false,
  view,
  frame,
  minimap,
  calibration,
  tags = [],
  onTagClick,
  onPlaceTag,
  onLoadingChange,
}: SplatSceneProps) => {
  const isMobile = useIsMobile();
  const placement = useMemo(() => resolvePlacement(frame, view), [frame, view]);
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const containerRef = useRef<HTMLDivElement>(null);
  const splatRef = useRef<SplatMesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const calibrationMarkersRef = useRef<THREE.Sprite[]>([]);
  // The collision mesh as loaded (without placement) and the placement its collider was built for.
  const colliderSourceRef = useRef<THREE.Object3D | null>(null);
  const colliderRef = useRef<Collider | null>(null);
  const colliderPlacementRef = useRef<typeof placement | null>(null);
  const walkRef = useRef<WalkControls | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const modeRef = useRef<ViewMode>('orbit');
  const callbacks = useRef({ onTagClick, onPlaceTag, onLoadingChange });
  callbacks.current = { onTagClick, onPlaceTag, onLoadingChange };
  const calibrationRef = useRef(calibration);
  calibrationRef.current = calibration;
  const viewRef = useRef(view);
  viewRef.current = view;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCollider, setHasCollider] = useState(false);
  const [mode, setModeState] = useState<ViewMode>('orbit');
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  // Where the camera is, for the floor plan; updated every frame without re-rendering.
  const poseRef = useRef<MapPose>({ ready: false, x: 0, z: 0, heading: 0, fov: 1.5 });

  const applyMode = useCallback((next: ViewMode) => {
    const walk = walkRef.current;
    const orbit = orbitRef.current;
    if (!walk || !orbit) return;
    const camera = orbit.object as THREE.PerspectiveCamera;
    modeRef.current = next;
    if (next === 'walk') {
      orbit.enabled = false;
      walk.enabled = true;
      walk.syncFromCamera();
      walk.placeAt(camera.position);
      camera.up.set(0, 1, 0);
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
    if (!container || !splatUrl) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setHasCollider(false);
    callbacks.current.onLoadingChange?.(true);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    colliderRef.current = null;
    colliderSourceRef.current = null;
    colliderPlacementRef.current = null;

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
      if (!colliderRef.current) return null;
      const ray = pointerToRay(clientX, clientY);
      return raycastCollider(colliderRef.current, ray.origin, ray.direction);
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
      // Calibration picks are handled by the pointer listener below.
      if (calibrationRef.current) return;
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
        if (walk.isActive || calibrationRef.current) return;
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

    // Calibration: a tap (press and release without dragging) on the model picks a point.
    let pressAt: { x: number; y: number } | null = null;
    const onCalibrationDown = (event: PointerEvent) => {
      pressAt = { x: event.clientX, y: event.clientY };
    };
    const onCalibrationUp = (event: PointerEvent) => {
      const press = pressAt;
      pressAt = null;
      const active = calibrationRef.current;
      if (!active || !press) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > DWELL_MOVE_PX) return;
      const point = pickPoint(event.clientX, event.clientY);
      if (point) active.onPick(point);
    };
    dom.addEventListener('pointerdown', onCalibrationDown);
    dom.addEventListener('pointerup', onCalibrationUp);

    const spark = new SparkRenderer({ renderer });
    scene.add(spark);
    const splat = new SplatMesh({ url: splatUrl, fileType: getSplatFileType(splatUrl) });
    applyPlacementTo(splat, placementRef.current);
    splatRef.current = splat;
    scene.add(splat);

    const collisionPromise: Promise<Collider | null> = collisionUrl
      ? new GLTFLoader()
          .loadAsync(collisionUrl)
          .then(gltf => {
            // The collision mesh shares the splat's source frame, so it gets the same placement.
            applyPlacementTo(gltf.scene, placementRef.current);
            colliderSourceRef.current = gltf.scene;
            colliderPlacementRef.current = placementRef.current;
            return createCollider(gltf.scene);
          })
          .catch(err => {
            console.warn('Collision mesh unavailable, walking without collision:', err);
            return null;
          })
      : Promise.resolve(null);

    Promise.all([splat.initialized, collisionPromise])
      .then(([, loadedCollider]) => {
        if (cancelled) return;
        colliderRef.current = loadedCollider;
        walk.collider = loadedCollider;
        setHasCollider(Boolean(loadedCollider));

        const box = splat.getBoundingBox(true);
        const center = box
          .getCenter(new THREE.Vector3())
          .applyMatrix4(placementToMatrix(placementRef.current));
        const radius = Math.max(
          (box.getSize(new THREE.Vector3()).length() / 2) * placementRef.current.scale,
          0.5
        );
        const start = viewRef.current?.start;
        const startTarget = start ? new THREE.Vector3(...start.target) : null;
        const spot = loadedCollider && !start ? findStartSpot(loadedCollider) : null;
        if (start && startTarget) {
          camera.position.set(...start.position);
          camera.lookAt(startTarget);
          orbit.target.copy(startTarget);
          if (loadedCollider) {
            applyMode('walk');
          } else {
            orbit.update();
            applyMode('orbit');
          }
        } else if (spot && loadedCollider) {
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
        setIsLoading(false);
        callbacks.current.onLoadingChange?.(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der 3D-Szene');
        setIsLoading(false);
        callbacks.current.onLoadingChange?.(false);
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
    const forward = new THREE.Vector3();
    const pose = poseRef.current;
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      if (modeRef.current === 'walk') walk.update(dt);
      else orbit.update();

      camera.getWorldDirection(forward);
      pose.x = camera.position.x;
      pose.z = camera.position.z;
      // Looking straight up or down has no direction on the plan; keep the last one.
      if (Math.abs(forward.y) < 0.98) pose.heading = Math.atan2(forward.z, forward.x);
      pose.fov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
      pose.ready = true;

      // Hide markers that are behind walls.
      for (const marker of markersRef.current) {
        let visible = true;
        const collider = colliderRef.current;
        if (collider) {
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
      dom.removeEventListener('pointerdown', onCalibrationDown);
      dom.removeEventListener('pointerup', onCalibrationUp);
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      walk.dispose();
      orbit.dispose();
      for (const marker of markersRef.current) {
        marker.sprite.material.map?.dispose();
        marker.sprite.material.dispose();
      }
      markersRef.current = [];
      for (const sprite of calibrationMarkersRef.current) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
      calibrationMarkersRef.current = [];
      colliderRef.current = null;
      colliderSourceRef.current = null;
      colliderPlacementRef.current = null;
      pose.ready = false;
      splatRef.current = null;
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
  }, [splatUrl, collisionUrl, applyMode]);

  // Keep the splat and its collision mesh at the space's placement. A calibration changes it
  // without reloading the files; only the collider's BVH is rebuilt. Splats exported from some
  // pipelines are upside down; `flipped` lets the user flip them on top of the placement.
  useEffect(() => {
    const splat = splatRef.current;
    if (!splat) return;
    applyPlacementTo(splat, placement);
    if (flipped) splat.quaternion.premultiply(new THREE.Quaternion(1, 0, 0, 0));

    const source = colliderSourceRef.current;
    if (source && colliderPlacementRef.current !== placement) {
      applyPlacementTo(source, placement);
      const rebuilt = createCollider(source);
      colliderRef.current = rebuilt;
      colliderPlacementRef.current = placement;
      if (walkRef.current) walkRef.current.collider = rebuilt;
    }
  }, [flipped, isLoading, placement]);

  // The floor plan is cut from the collision mesh at its current placement, so it is built after
  // the effect above has placed the mesh, and again after every calibration.
  useEffect(() => {
    const source = colliderSourceRef.current;
    // Phones have no minimap (the screen is too small for it), so there is no plan to cut.
    if (isLoading || !source || isMobile) {
      setFloorPlan(null);
      return;
    }
    // Let the first frames render before the one-off cut (a few hundred ms for large meshes).
    const timer = setTimeout(() => {
      try {
        setFloorPlan(buildFloorPlan(source));
      } catch (err) {
        console.warn('Floor plan unavailable:', err);
        setFloorPlan(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isLoading, placement, isMobile]);

  const teleportTo = useCallback(
    (x: number, z: number) => {
      const walk = walkRef.current;
      const collider = colliderRef.current;
      if (!walk || !collider || !floorPlan) return;
      // Only spots with a floor below them; the plan also shows walls and the void around them.
      const probe = new THREE.Vector3(x, floorPlan.floorY + 1.5, z);
      if (floorHeightBelow(collider, probe) === null) return;
      if (modeRef.current !== 'walk') applyMode('walk');
      walk.placeAt(probe);
    },
    [applyMode, floorPlan]
  );

  const mapTags = useMemo<MapTag[]>(
    () =>
      tags
        .filter(tag => Number.isFinite(Number(tag.x)) && Number.isFinite(Number(tag.z)))
        .map(tag => ({
          x: Number(tag.x),
          z: Number(tag.z),
          color: TAG_COLORS[tag.tag_type === 'room' ? 'room' : 'object'],
        })),
    [tags]
  );

  // Calibrating happens from the outside: orbit view, no walking, no tag placing.
  const isCalibrating = Boolean(calibration);
  useEffect(() => {
    if (isCalibrating) applyMode('orbit');
  }, [isCalibrating, applyMode]);

  // Markers for the points picked so far.
  const calibrationPoints = calibration?.points;
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (const sprite of calibrationMarkersRef.current) {
      scene.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    const texture = makeMarkerTexture(CALIBRATION_COLOR);
    calibrationMarkersRef.current = (calibrationPoints ?? []).map(point => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          depthTest: false,
          transparent: true,
          sizeAttenuation: false,
        })
      );
      sprite.scale.set(0.04, 0.04, 1);
      sprite.renderOrder = 1000;
      sprite.position.copy(point);
      scene.add(sprite);
      return sprite;
    });
  }, [calibrationPoints, isLoading]);

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
              px: 2,
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
        </ToggleButtonGroup>
      )}

      {!isLoading && !error && !isCalibrating && !isMobile && (floorPlan || minimap) && (
        <FloorPlanMap
          plan={floorPlan}
          minimap={minimap}
          placement={placement}
          poseRef={poseRef}
          tags={mapTags}
          onTeleport={teleportTo}
        />
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
            : isMobile
              ? 'Stick: gehen · Wischen: umsehen · Tippen: hingehen · Halten: Ort anlegen'
              : `WASD: gehen (Shift: schneller) · Ziehen: umsehen · Klick: hingehen · ${DWELL_MS / 1000} s ruhen: Ort anlegen${hasCollider ? '' : ' · ohne Kollision'}`}
        </Typography>
      )}
    </Box>
  );
};
