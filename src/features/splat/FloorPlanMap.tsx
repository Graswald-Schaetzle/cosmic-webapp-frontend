import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import { FloorPlan, PlanView, createPlanView } from './floorPlan';
import { ImageCrop, SpaceMinimap, createImageView, findContentCrop } from './minimapImage';
import { SplatPlacement } from './spaceFrame';

/** Where the viewer's camera is, in the space frame. Written every frame by the scene. */
export interface MapPose {
  ready: boolean;
  x: number;
  z: number;
  /** Direction the camera looks in, as an angle in the x/z plane (atan2(z, x)). */
  heading: number;
  /** Horizontal field of view in radians. */
  fov: number;
}

export interface MapTag {
  x: number;
  z: number;
  color: string;
}

interface FloorPlanMapProps {
  /** The plan cut from the collision mesh; used when there is no minimap image. */
  plan: FloorPlan | null;
  /** A pre-rendered minimap image, which takes precedence over the cut plan. */
  minimap?: SpaceMinimap | null;
  /** How the space's source frame sits in the space frame (the image follows it). */
  placement: SplatPlacement;
  poseRef: MutableRefObject<MapPose>;
  tags?: MapTag[];
  isMobile?: boolean;
  /** Called with a spot of the space frame when the user taps the plan. */
  onTeleport?: (x: number, z: number) => void;
}

const STORAGE_KEY = 'cosmic_splat_minimap';
const PADDING = 14;
const COLORS = {
  body: '#EFEDE9',
  floor: '#FFFFFF',
  wallShadow: 'rgba(0, 0, 0, 0.1)',
  wall: '#34312E',
  marker: '#1FA9E8',
};
const CONE_LENGTH = 38;
/** The longest side of the image used to find the drawn area, in pixels. */
const CROP_PROBE_SIZE = 512;
/** Empty paper kept around the drawing, in pixels of a 1024 px wide image. */
const CROP_MARGIN = 16;

interface LoadedMinimap {
  image: HTMLImageElement;
  crop: ImageCrop;
}

type MinimapState =
  { status: 'none' | 'loading' | 'failed' } | { status: 'ready'; loaded: LoadedMinimap };

/** Loads the minimap image and finds the part of it that is drawn on, to waste no panel space. */
function useMinimapImage(url: string | undefined): MinimapState {
  const [state, setState] = useState<MinimapState>({ status: url ? 'loading' : 'none' });
  useEffect(() => {
    if (!url) {
      setState({ status: 'none' });
      return;
    }
    setState({ status: 'loading' });
    let cancelled = false;
    const load = (withCors: boolean) => {
      const image = new Image();
      if (withCors) image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (cancelled) return;
        const full = { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
        let crop = full;
        // Reading pixels needs a CORS-enabled load; without it the whole image is shown.
        if (withCors) {
          try {
            const factor = Math.min(1, CROP_PROBE_SIZE / Math.max(full.width, full.height));
            const probe = document.createElement('canvas');
            probe.width = Math.max(1, Math.round(full.width * factor));
            probe.height = Math.max(1, Math.round(full.height * factor));
            const probeCtx = probe.getContext('2d', { willReadFrequently: true });
            probeCtx?.drawImage(image, 0, 0, probe.width, probe.height);
            const pixels = probeCtx?.getImageData(0, 0, probe.width, probe.height);
            const found =
              pixels &&
              findContentCrop(
                pixels.data,
                probe.width,
                probe.height,
                Math.round((CROP_MARGIN * probe.width) / 1024)
              );
            if (found) {
              crop = {
                x: found.x / factor,
                y: found.y / factor,
                width: found.width / factor,
                height: found.height / factor,
              };
            }
          } catch {
            crop = full;
          }
        }
        setState({ status: 'ready', loaded: { image, crop } });
      };
      image.onerror = () => {
        if (cancelled) return;
        if (withCors) load(false);
        else setState({ status: 'failed' });
      };
      image.src = url;
    };
    load(true);
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

interface MapSource {
  kind: 'plan' | 'image';
  view: PlanView;
  drawBase: (ctx: CanvasRenderingContext2D) => void;
}

const readOpen = (fallback: boolean) => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
};

function drawPlan(ctx: CanvasRenderingContext2D, plan: FloorPlan, view: PlanView) {
  ctx.clearRect(0, 0, view.width, view.height);
  const outline = new Path2D();
  for (const { points, closed } of plan.paths) {
    points.forEach(([x, z], i) => {
      const [px, py] = view.toScreen(x, z);
      if (i === 0) outline.moveTo(px, py);
      else outline.lineTo(px, py);
    });
    if (closed) outline.closePath();
  }
  // Even-odd, so pillars and furniture inside a room stay open.
  ctx.fillStyle = COLORS.floor;
  ctx.fill(outline, 'evenodd');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS.wallShadow;
  ctx.lineWidth = 6;
  ctx.stroke(outline);
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 2;
  ctx.stroke(outline);
}

function drawDynamic(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  view: PlanView,
  pose: MapPose,
  tags: MapTag[]
) {
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.drawImage(base, 0, 0, view.width, view.height);

  for (const tag of tags) {
    const [px, py] = view.toScreen(tag.x, tag.z);
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = tag.color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  }

  if (!pose.ready) return;
  const [px, py] = view.toScreen(pose.x, pose.z);
  const heading = view.headingToScreen(pose.heading);
  const half = Math.min(Math.max(pose.fov, 0.9), 1.8) / 2;

  const cone = ctx.createRadialGradient(px, py, 0, px, py, CONE_LENGTH);
  cone.addColorStop(0, 'rgba(31, 169, 232, 0.6)');
  cone.addColorStop(1, 'rgba(31, 169, 232, 0)');
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, CONE_LENGTH, heading - half, heading + half);
  ctx.closePath();
  ctx.fillStyle = cone;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(px, py, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.marker;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
}

/**
 * A top-down floor plan of the space with the viewer's position and viewing direction, drawn
 * on a canvas that follows the camera every frame without re-rendering React.
 */
export const FloorPlanMap = ({
  plan,
  minimap,
  placement,
  poseRef,
  tags = [],
  isMobile,
  onTeleport,
}: FloorPlanMapProps) => {
  const [open, setOpen] = useState(() => readOpen(!isMobile));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const minimapImage = useMinimapImage(minimap?.url);
  const maxWidth = isMobile ? 190 : 300;
  const maxHeight = isMobile ? 150 : 230;
  const source = useMemo<MapSource | null>(() => {
    if (minimap && minimapImage.status === 'loading') return null;
    if (minimap && minimapImage.status === 'ready') {
      const { image, crop } = minimapImage.loaded;
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      const view = createImageView(minimap.frame, placement, size, crop, maxWidth, maxHeight);
      return {
        kind: 'image',
        view,
        drawBase: ctx => {
          ctx.fillStyle = COLORS.floor;
          ctx.fillRect(0, 0, view.width, view.height);
          ctx.drawImage(
            image,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            view.width,
            view.height
          );
        },
      };
    }
    if (!plan) return null;
    const view = createPlanView(plan, maxWidth, maxHeight, PADDING);
    return { kind: 'plan', view, drawBase: ctx => drawPlan(ctx, plan, view) };
  }, [minimap, minimapImage, placement, plan, maxWidth, maxHeight]);

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // the choice just is not remembered
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!open || !canvas || !ctx || !source) return;
    const { view } = source;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);

    const base = document.createElement('canvas');
    base.width = canvas.width;
    base.height = canvas.height;
    const baseCtx = base.getContext('2d');
    if (!baseCtx) return;
    baseCtx.scale(ratio, ratio);
    source.drawBase(baseCtx);
    ctx.scale(ratio, ratio);

    let frame = 0;
    let drawn = { x: NaN, z: NaN, heading: NaN, fov: NaN, tags: null as MapTag[] | null };
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const pose = poseRef.current;
      const tagsNow = tagsRef.current;
      if (
        pose.x === drawn.x &&
        pose.z === drawn.z &&
        pose.heading === drawn.heading &&
        pose.fov === drawn.fov &&
        tagsNow === drawn.tags
      ) {
        return;
      }
      drawn = { x: pose.x, z: pose.z, heading: pose.heading, fov: pose.fov, tags: tagsNow };
      drawDynamic(ctx, base, view, pose, tagsNow);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [open, source, poseRef]);

  const glass = {
    backgroundColor: 'rgba(46, 46, 46, 0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };

  if (!source) return null;
  const { view } = source;

  if (!open) {
    return (
      <IconButton
        aria-label="Grundriss öffnen"
        onClick={() => toggle(true)}
        sx={{
          position: 'absolute',
          right: 16,
          bottom: 68,
          zIndex: 20,
          color: 'rgba(255,255,255,0.9)',
          ...glass,
          '&:hover': { backgroundColor: 'rgba(46, 46, 46, 0.8)' },
        }}
      >
        <MapOutlinedIcon />
      </IconButton>
    );
  }

  return (
    <Box
      data-testid="floor-plan-map"
      sx={{
        position: 'absolute',
        right: 16,
        bottom: 68,
        zIndex: 20,
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        backgroundColor: source.kind === 'image' ? COLORS.floor : COLORS.body,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pl: 1.75,
          pr: 0.5,
          height: 32,
          ...glass,
          // The plan below is light, so the header needs more weight than the floating buttons.
          backgroundColor: 'rgba(46, 46, 46, 0.92)',
        }}
      >
        <Typography sx={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Grundriss</Typography>
        <IconButton
          size="small"
          aria-label="Grundriss schließen"
          onClick={() => toggle(false)}
          sx={{ color: 'rgba(255,255,255,0.8)' }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <canvas
        ref={canvasRef}
        onClick={event => {
          if (!onTeleport) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const [x, z] = view.toPlan(event.clientX - rect.left, event.clientY - rect.top);
          onTeleport(x, z);
        }}
        style={{
          display: 'block',
          width: view.width,
          height: view.height,
          cursor: onTeleport ? 'pointer' : 'default',
        }}
      />
    </Box>
  );
};
