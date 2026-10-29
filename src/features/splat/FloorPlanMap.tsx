import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import { FloorPlan, PlanView, createPlanView } from './floorPlan';

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
  plan: FloorPlan;
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
  const heading = pose.heading + view.rotation;
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
  poseRef,
  tags = [],
  isMobile,
  onTeleport,
}: FloorPlanMapProps) => {
  const [open, setOpen] = useState(() => readOpen(!isMobile));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const view = useMemo(
    () =>
      isMobile ? createPlanView(plan, 190, 150, PADDING) : createPlanView(plan, 300, 230, PADDING),
    [plan, isMobile]
  );

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
    if (!open || !canvas || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(view.width * ratio);
    canvas.height = Math.round(view.height * ratio);

    const base = document.createElement('canvas');
    base.width = canvas.width;
    base.height = canvas.height;
    const baseCtx = base.getContext('2d');
    if (!baseCtx) return;
    baseCtx.scale(ratio, ratio);
    drawPlan(baseCtx, plan, view);
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
  }, [open, plan, view, poseRef]);

  const glass = {
    backgroundColor: 'rgba(46, 46, 46, 0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };

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
        backgroundColor: COLORS.body,
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
