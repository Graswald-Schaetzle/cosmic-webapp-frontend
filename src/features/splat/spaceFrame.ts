import * as THREE from 'three';

/**
 * How a space's splat and collision mesh sit in the space frame (right-handed, Y up, metres):
 * p_space = translation + R * (scale * p_source), R from Euler XYZ degrees. Mirrors
 * spaces.space_frame in the backend.
 */
export interface SplatPlacement {
  scale: number;
  rotation_deg: [number, number, number];
  translation: [number, number, number];
}

export interface SpaceFrame {
  version: number;
  unit: 'm';
  up: 'y';
  splat: SplatPlacement;
}

export const IDENTITY_PLACEMENT: SplatPlacement = {
  scale: 1,
  rotation_deg: [0, 0, 0],
  translation: [0, 0, 0],
};

/** The frame's placement, or the rotation-only placement spaces had before they had a frame. */
export function resolvePlacement(
  frame?: SpaceFrame | null,
  legacyView?: { rotation_deg?: [number, number, number] } | null
): SplatPlacement {
  if (frame?.splat) return frame.splat;
  return { ...IDENTITY_PLACEMENT, rotation_deg: legacyView?.rotation_deg ?? [0, 0, 0] };
}

export function placementToMatrix(placement: SplatPlacement): THREE.Matrix4 {
  const [x, y, z] = placement.rotation_deg.map(THREE.MathUtils.degToRad);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...placement.translation),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ')),
    new THREE.Vector3().setScalar(placement.scale)
  );
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

export function matrixToPlacement(matrix: THREE.Matrix4): SplatPlacement {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return {
    scale: round((scale.x + scale.y + scale.z) / 3),
    rotation_deg: [euler.x, euler.y, euler.z].map(a => round(THREE.MathUtils.radToDeg(a))) as [
      number,
      number,
      number,
    ],
    translation: [position.x, position.y, position.z].map(round) as [number, number, number],
  };
}

/** Moves the model by a change of the space frame (delta is applied after the placement). */
export function applyFrameDelta(placement: SplatPlacement, delta: THREE.Matrix4): SplatPlacement {
  return matrixToPlacement(delta.clone().multiply(placementToMatrix(placement)));
}

/** Sets an object's transform from a placement. */
export function applyPlacementTo(object: THREE.Object3D, placement: SplatPlacement): void {
  placementToMatrix(placement).decompose(object.position, object.quaternion, object.scale);
}

// Calibration steps. Each takes points picked on the model, in the current space frame, and
// returns the change of the space frame that fixes one thing; null when the points do not
// determine it.

/** A floor plane steeper than this (normal.y below it) is not a floor. */
const MIN_FLOOR_NORMAL_Y = 0.5;

/** Three floor points: the floor becomes the plane y = 0 and points up. */
export function floorAlignment(points: THREE.Vector3[]): THREE.Matrix4 | null {
  if (points.length < 3) return null;
  const [a, b, c] = points;
  const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  if (normal.lengthSq() < 1e-12) return null;
  normal.normalize();
  if (normal.y < 0) normal.negate();
  if (normal.y < MIN_FLOOR_NORMAL_Y) return null;

  const rotation = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 1, 0));
  const centroid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
  centroid.applyQuaternion(rotation);
  return new THREE.Matrix4()
    .makeTranslation(0, -centroid.y, 0)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(rotation));
}

/** Two points that are `lengthM` metres apart: uniform scale about the origin. */
export function scaleFromReference(points: THREE.Vector3[], lengthM: number): THREE.Matrix4 | null {
  if (points.length < 2 || !(lengthM > 0)) return null;
  const distance = points[0].distanceTo(points[1]);
  if (distance < 1e-6) return null;
  return new THREE.Matrix4().makeScale(lengthM / distance, lengthM / distance, lengthM / distance);
}

/** Origin point (kept at its height) and a second point that lies in the +X direction. */
export function originAlignment(points: THREE.Vector3[]): THREE.Matrix4 | null {
  if (points.length < 2) return null;
  const [origin, direction] = points;
  const dx = direction.x - origin.x;
  const dz = direction.z - origin.z;
  if (Math.hypot(dx, dz) < 1e-6) return null;
  return new THREE.Matrix4()
    .makeRotationY(Math.atan2(dz, dx))
    .multiply(new THREE.Matrix4().makeTranslation(-origin.x, 0, -origin.z));
}
