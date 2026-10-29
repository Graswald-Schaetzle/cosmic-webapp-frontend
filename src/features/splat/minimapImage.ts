import * as THREE from 'three';
import { PlanPoint, PlanView } from './floorPlan';
import { SplatPlacement, placementToMatrix } from './spaceFrame';

/**
 * Where a minimap image sits, in the source coordinates of the space's splat and collision mesh
 * (the same frame `spaces.space_frame` places into the space frame). `origin` is the image's
 * top-left corner; `u` runs along its full width and `v` along its full height.
 */
export interface MinimapFrame {
  origin: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
}

/** A pre-rendered minimap of a space, as delivered by the backend. */
export interface SpaceMinimap {
  url: string;
  frame: MinimapFrame;
}

/** The part of the image that is shown, in image pixels. */
export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pixels lighter than this count as the white of the paper. */
const PAPER_LUMINANCE = 235;

/** The smallest box around everything that is not white, with a margin; null if blank. */
export function findContentCrop(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  margin: number
): ImageCrop | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luminance = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      if (rgba[i + 3] > 16 && luminance < PAPER_LUMINANCE) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - margin);
  const y = Math.max(0, minY - margin);
  return {
    x,
    y,
    width: Math.min(width, maxX + 1 + margin) - x,
    height: Math.min(height, maxY + 1 + margin) - y,
  };
}

/**
 * Fits the cropped image into `maxWidth` x `maxHeight` pixels. Image pixels map to the space
 * frame's x/z plane by the frame's corners after the placement, so the minimap follows every
 * calibration of the space.
 */
export function createImageView(
  frame: MinimapFrame,
  placement: SplatPlacement,
  image: { width: number; height: number },
  crop: ImageCrop,
  maxWidth: number,
  maxHeight: number
): PlanView {
  const matrix = placementToMatrix(placement);
  const place = (point: [number, number, number]) =>
    new THREE.Vector3(...point).applyMatrix4(matrix);
  const origin = place(frame.origin);
  const across = place(frame.origin.map((c, i) => c + frame.u[i]) as [number, number, number]).sub(
    origin
  );
  const down = place(frame.origin.map((c, i) => c + frame.v[i]) as [number, number, number]).sub(
    origin
  );

  // Space (x, z) of an image pixel: origin + across * px / width + down * py / height.
  const ax = across.x / image.width;
  const az = across.z / image.width;
  const dx = down.x / image.height;
  const dz = down.z / image.height;
  const determinant = ax * dz - dx * az;

  const scale = Math.min(maxWidth / crop.width, maxHeight / crop.height);
  const toImage = (x: number, z: number): PlanPoint => {
    const rx = x - origin.x;
    const rz = z - origin.z;
    return [(dz * rx - dx * rz) / determinant, (-az * rx + ax * rz) / determinant];
  };
  const toPlan = (px: number, py: number): PlanPoint => {
    const ix = px / scale + crop.x;
    const iy = py / scale + crop.y;
    return [origin.x + ax * ix + dx * iy, origin.z + az * ix + dz * iy];
  };
  return {
    width: crop.width * scale,
    height: crop.height * scale,
    // Pixels per metre, from the length of the image's width.
    scale: (scale * image.width) / Math.hypot(across.x, across.z),
    headingToScreen: heading => {
      const [x, y] = toImage(origin.x + Math.cos(heading), origin.z + Math.sin(heading));
      const [x0, y0] = toImage(origin.x, origin.z);
      return Math.atan2(y - y0, x - x0);
    },
    toScreen: (x, z) => {
      const [ix, iy] = toImage(x, z);
      return [(ix - crop.x) * scale, (iy - crop.y) * scale];
    },
    toPlan,
  };
}
