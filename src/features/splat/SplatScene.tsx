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

/** A press that moves less than this counts as a tap (calibration picks). */
const TAP_MOVE_PX = 15;
/** A secondary click shorter than this places a tag; holding longer only opens the menus. */
const SECONDARY_CLICK_MAX_MS = 350;
/** Pressing and holding a spot on a touch screen for this long places a tag. */
const LONG_PRESS_MS = 600;
const MARKER_PICK_RADIUS_PX = 28;
/** Half size of the "[ ]" reticle in the middle of the view while the mouse looks around. */
const RETICLE_HALF_W_PX = 40;
const RETICLE_HALF_H_PX = 30;
/** Colour of the "[ ]" reticle while a tag is inside it. */
const RETICLE_TAG_COLOR = '#3380FF';

export type ViewMode = 'walk' | 'orbit';

/**
 * How the mouse is used on desktop while walking:
 * - free: the pointer is a normal cursor; a click on the scene starts mouse look.
 * - look: the pointer is locked and the mouse turns the view like in a first-person game; the
 *   menus are faded out so the scene stays clear.
 * - menu: the secondary mouse button is held; the pointer is released so the menus can be used,
 *   they are brought forward and the scene steps back.
 * The state is mirrored to `data-look-mode` on <html> so the app's menus (outside this
 * component) can follow it with the `cosmic-hud` class.
 */
export type LookState = 'free' | 'look' | 'menu';

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
  /** Called when the user right-clicks a spot of the model (the crosshair spot while looking). */
  onPlaceTag?: (position: { x: number; y: number; z: number }) => void;
  onLoadingChange?: (loading: boolean) => void;
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
  const mouseLookRef = useRef(!isMobile);
  mouseLookRef.current = !isMobile;
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
  const [lookState, setLookState] = useState<LookState>('free');
  // Whether a tag is inside the "[ ]" reticle right now.
  const [tagInReticle, setTagInReticle] = useState(false);
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
      walk.exitLock();
      walk.enabled = false;
      orbit.enabled = true;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      orbit.target.copy(camera.position).addScaledVector(direction, 3);
      orbit.update();
    }
    setModeState(next);
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

    const centerOfView = () => {
      const rect = renderer.domElement.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };

    // Mouse look: the secondary button is held (menu), and what the menus did meanwhile.
    let menuHeld = false;
    let usedMenu = false;
    let relockOnUnlock = false;

    /** The visible tag marker under a screen point, or inside the reticle while the mouse looks. */
    const findMarker = (clientX: number, clientY: number, inReticle: boolean): Marker | null => {
      let nearest: Marker | null = null;
      let nearestDistance = Infinity;
      for (const marker of markersRef.current) {
        if (!marker.visible) continue;
        const screen = projectToClient(marker.sprite.position);
        if (!screen.inFront) continue;
        const dx = Math.abs(screen.x - clientX);
        const dy = Math.abs(screen.y - clientY);
        const distance = Math.hypot(dx, dy);
        const hit = inReticle
          ? dx <= RETICLE_HALF_W_PX && dy <= RETICLE_HALF_H_PX
          : distance < MARKER_PICK_RADIUS_PX;
        if (hit && distance < nearestDistance) {
          nearest = marker;
          nearestDistance = distance;
        }
      }
      return nearest;
    };

    const handleTap = (clientX: number, clientY: number, pointerType: string) => {
      // Calibration picks are handled by the pointer listener below.
      if (calibrationRef.current) return;
      const locked = walk.locked;

      if (locked) {
        // Mouse look: the click acts inside the "[ ]" in the middle of the view. The windows
        // that open need the cursor, so the mouse is let go.
        const tag = findMarker(clientX, clientY, true);
        if (tag) {
          callbacks.current.onTagClick?.(tag.location);
          walk.exitLock();
        }
        return;
      }

      const tag = findMarker(clientX, clientY, false);
      if (tag) {
        // Opening a window with the menu button held is a menu use: the mouse stays free.
        if (menuHeld) usedMenu = true;
        callbacks.current.onTagClick?.(tag.location);
        return;
      }
      if (modeRef.current === 'walk') {
        // A click on the empty scene hands the mouse to the view, unless the menus are in use.
        if (pointerType === 'mouse' && walk.mouseLook) {
          if (!menuHeld) walk.requestLock();
          return;
        }
        // Touch: walk to the tapped spot.
        const point = pickPoint(clientX, clientY);
        if (point) walk.walkTo(point);
      }
    };

    const walk = new WalkControls(camera, renderer.domElement, {
      onTap: handleTap,
      onLockChange: locked => {
        if (locked) {
          setLookState('look');
          return;
        }
        if (relockOnUnlock) {
          // The menu button was released before the browser had let go; take the mouse back.
          relockOnUnlock = false;
          walk.requestLock();
          return;
        }
        setLookState(menuHeld ? 'menu' : 'free');
      },
      onLockError: () => {
        menuHeld = false;
        relockOnUnlock = false;
        setLookState('free');
      },
    });
    walk.mouseLook = mouseLookRef.current;
    walk.enabled = false;
    walkRef.current = walk;

    const dom = renderer.domElement;

    // Touch: pressing and holding a spot without moving places a tag there (the counterpart of
    // the secondary click on desktop). A second finger (pinch) or any movement cancels it.
    let longPress: {
      timer: ReturnType<typeof setTimeout>;
      id: number;
      x: number;
      y: number;
    } | null = null;
    const clearLongPress = () => {
      if (longPress) clearTimeout(longPress.timer);
      longPress = null;
    };
    const onLongPressDown = (event: PointerEvent) => {
      const alreadyPressing = longPress !== null;
      clearLongPress();
      if (event.pointerType !== 'touch' || alreadyPressing) return;
      if (modeRef.current !== 'walk' || calibrationRef.current) return;
      const { clientX: x, clientY: y, pointerId: id } = event;
      const timer = setTimeout(() => {
        longPress = null;
        const point = pickPoint(x, y);
        if (!point) return;
        navigator.vibrate?.(30);
        callbacks.current.onPlaceTag?.({ x: point.x, y: point.y, z: point.z });
      }, LONG_PRESS_MS);
      longPress = { timer, id, x, y };
    };
    const onLongPressMove = (event: PointerEvent) => {
      if (!longPress || event.pointerId !== longPress.id) return;
      if (Math.hypot(event.clientX - longPress.x, event.clientY - longPress.y) > TAP_MOVE_PX) {
        clearLongPress();
      }
    };
    dom.addEventListener('pointerdown', onLongPressDown);
    dom.addEventListener('pointermove', onLongPressMove);
    dom.addEventListener('pointerup', clearLongPress);
    dom.addEventListener('pointercancel', clearLongPress);
    dom.addEventListener('pointerleave', clearLongPress);

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
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_MOVE_PX) return;
      const point = pickPoint(event.clientX, event.clientY);
      if (point) active.onPick(point);
    };
    dom.addEventListener('pointerdown', onCalibrationDown);
    dom.addEventListener('pointerup', onCalibrationUp);

    // A short secondary click places a tag where the crosshair points (or at the cursor while the
    // mouse is free). Holding the button lets go of the pointer for as long as it is held, so the
    // menus can be clicked; letting go takes the mouse back unless a menu was used (it may have
    // opened a window that needs the cursor).
    let secondaryPress: { at: number; point: THREE.Vector3 | null } | null = null;
    const onWindowPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      if (event.button === 2 && (walk.locked || event.target === dom)) {
        if (modeRef.current === 'walk' && !calibrationRef.current) {
          const spot = walk.locked ? centerOfView() : { x: event.clientX, y: event.clientY };
          secondaryPress = { at: performance.now(), point: pickPoint(spot.x, spot.y) };
        }
        if (walk.locked) {
          menuHeld = true;
          usedMenu = false;
          walk.exitLock();
        }
      } else if (event.button === 0 && menuHeld) {
        const target = event.target as Element | null;
        if (target !== dom && !target?.closest?.('[data-keep-look]')) usedMenu = true;
      }
    };
    const onWindowPointerUp = (event: PointerEvent) => {
      if (event.button !== 2) return;
      const press = secondaryPress;
      secondaryPress = null;
      if (press?.point && !usedMenu && performance.now() - press.at <= SECONDARY_CLICK_MAX_MS) {
        // The window that opens needs the cursor, so the mouse stays free.
        menuHeld = false;
        setLookState('free');
        callbacks.current.onPlaceTag?.({ x: press.point.x, y: press.point.y, z: press.point.z });
        return;
      }
      if (!menuHeld) return;
      menuHeld = false;
      if (usedMenu || modeRef.current !== 'walk') {
        setLookState('free');
      } else if (walk.locked) {
        relockOnUnlock = true;
      } else {
        walk.requestLock();
      }
    };
    const onWindowBlur = () => {
      if (!menuHeld) return;
      menuHeld = false;
      setLookState('free');
    };
    const onContextMenu = (event: MouseEvent) => {
      if (modeRef.current !== 'walk') return;
      const target = event.target as HTMLElement | null;
      // Touch: holding a spot places a tag, the browser's own long-press menu must not open.
      if (!walk.mouseLook) {
        if (target === dom) event.preventDefault();
        return;
      }
      if (target?.closest?.('input, textarea, [contenteditable]')) return;
      event.preventDefault();
    };
    window.addEventListener('pointerdown', onWindowPointerDown, true);
    window.addEventListener('pointerup', onWindowPointerUp, true);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('contextmenu', onContextMenu);

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
    const reticleProbe = new THREE.Vector3();
    let tagInReticleShown = false;
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
      // Tell the reticle when a tag is inside it, so the user knows a click opens the tag.
      let inReticle = false;
      if (walk.locked) {
        const halfW = renderer.domElement.clientWidth / 2;
        const halfH = renderer.domElement.clientHeight / 2;
        for (const marker of markersRef.current) {
          if (!marker.visible) continue;
          reticleProbe.copy(marker.sprite.position).project(camera);
          if (
            reticleProbe.z < 1 &&
            Math.abs(reticleProbe.x * halfW) <= RETICLE_HALF_W_PX &&
            Math.abs(reticleProbe.y * halfH) <= RETICLE_HALF_H_PX
          ) {
            inReticle = true;
            break;
          }
        }
      }
      if (inReticle !== tagInReticleShown) {
        tagInReticleShown = inReticle;
        setTagInReticle(inReticle);
      }
      renderer.render(scene, camera);
    });

    return () => {
      cancelled = true;
      clearLongPress();
      dom.removeEventListener('pointerdown', onLongPressDown);
      dom.removeEventListener('pointermove', onLongPressMove);
      dom.removeEventListener('pointerup', clearLongPress);
      dom.removeEventListener('pointercancel', clearLongPress);
      dom.removeEventListener('pointerleave', clearLongPress);
      dom.removeEventListener('pointerdown', onCalibrationDown);
      dom.removeEventListener('pointerup', onCalibrationUp);
      window.removeEventListener('pointerdown', onWindowPointerDown, true);
      window.removeEventListener('pointerup', onWindowPointerUp, true);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('contextmenu', onContextMenu);
      setLookState('free');
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

  // The app's menus follow the mouse look state through the document (see LookState).
  useEffect(() => {
    document.documentElement.dataset.lookMode = lookState;
    return () => {
      delete document.documentElement.dataset.lookMode;
    };
  }, [lookState]);

  // Hide the control hint after a few seconds.
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => setShowHint(false), 14000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />

      {/* While the menus are held forward, the scene steps back. */}
      <Box
        data-testid="look-dim"
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          pointerEvents: 'none',
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          opacity: lookState === 'menu' ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      />

      {lookState === 'look' && (
        <Box
          data-testid="look-reticle"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: RETICLE_HALF_W_PX * 2,
            height: RETICLE_HALF_H_PX * 2,
            transform: 'translate(-50%, -50%)',
            color: tagInReticle ? RETICLE_TAG_COLOR : 'rgba(255, 255, 255, 0.9)',
            filter: 'drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.7))',
            transition: 'color 0.15s ease',
            zIndex: 15,
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 14,
              height: '100%',
              border: '2px solid currentColor',
              borderRight: 'none',
              borderRadius: '2px 0 0 2px',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 14,
              height: '100%',
              border: '2px solid currentColor',
              borderLeft: 'none',
              borderRadius: '0 2px 2px 0',
            }}
          />
        </Box>
      )}

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

      {!isLoading && !error && (
        <ToggleButtonGroup
          className="cosmic-hud"
          data-keep-look
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

      {!isLoading &&
        !error &&
        mode === 'walk' &&
        !isMobile &&
        !isCalibrating &&
        lookState === 'free' && (
          <Typography
            sx={{
              position: 'absolute',
              bottom: 76,
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
              pointerEvents: 'none',
            }}
          >
            Klicken, um dich mit der Maus umzusehen
          </Typography>
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
              ? 'Stick: gehen · Wischen: umsehen · Tippen: hingehen · Lang tippen: Tag anlegen'
              : `WASD: gehen (Shift: rennen) · Leertaste: springen · C: ducken · Z: liegen · Maus: umsehen · Klick auf Tag: öffnen · Rechtsklick: Tag anlegen · Rechtsklick halten: Menüs · Esc: Maus freigeben${hasCollider ? '' : ' · ohne Kollision'}`}
        </Typography>
      )}
    </Box>
  );
};
