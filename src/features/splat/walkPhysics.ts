import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

/** Tunable body and movement parameters, in metres and seconds. */
export interface WalkParams {
  radius: number;
  height: number;
  eyeHeight: number;
  gravity: number;
  walkSpeed: number;
  runFactor: number;
  /** How high a jump from the ground lifts the feet. */
  jumpHeight: number;
  /** Maximum frame time that is simulated at once. */
  maxStep: number;
}

export const DEFAULT_WALK_PARAMS: WalkParams = {
  radius: 0.25,
  height: 1.75,
  eyeHeight: 1.6,
  gravity: -18,
  walkSpeed: 1.8,
  runFactor: 2,
  jumpHeight: 0.6,
  maxStep: 1 / 60,
};

/** Standing, crouching and lying down (as in a first-person game). */
export type Stance = 'stand' | 'crouch' | 'prone';

export interface StanceShape {
  /** Height of the body capsule. */
  height: number;
  /** Eye height above the feet. */
  eyeHeight: number;
  /** Walking speed relative to standing. */
  speedFactor: number;
}

export const STANCES: Record<Stance, StanceShape> = {
  stand: {
    height: DEFAULT_WALK_PARAMS.height,
    eyeHeight: DEFAULT_WALK_PARAMS.eyeHeight,
    speedFactor: 1,
  },
  crouch: { height: 1.1, eyeHeight: 0.95, speedFactor: 0.55 },
  // Never lower than the capsule is wide (two radii).
  prone: { height: 0.55, eyeHeight: 0.35, speedFactor: 0.25 },
};

/** Upward speed that lifts the feet by `jumpHeight` against gravity. */
export const jumpVelocity = (params: WalkParams = DEFAULT_WALK_PARAMS): number =>
  Math.sqrt(2 * Math.abs(params.gravity) * params.jumpHeight);

export interface Collider {
  bvh: MeshBVH;
  /** World-space bounds of the collision mesh. */
  bounds: THREE.Box3;
}

/** Builds a collider from every mesh in a loaded glTF scene (or any Object3D). */
export function createCollider(root: THREE.Object3D): Collider {
  root.updateMatrixWorld(true);
  const positions: number[] = [];
  const indices: number[] = [];
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    const position = geometry.getAttribute('position');
    const offset = positions.length / 3;
    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
    }
    if (geometry.index) {
      for (let i = 0; i < geometry.index.count; i++) indices.push(offset + geometry.index.getX(i));
    } else {
      for (let i = 0; i < position.count; i++) indices.push(offset + i);
    }
    geometry.dispose();
  });
  if (!indices.length) throw new Error('Collision mesh contains no triangles');

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeBoundingBox();
  return { bvh: new MeshBVH(merged), bounds: merged.boundingBox!.clone() };
}

export interface WalkerState {
  /** Feet position. */
  position: THREE.Vector3;
  verticalVelocity: number;
  onGround: boolean;
}

export function createWalkerState(position: THREE.Vector3): WalkerState {
  return { position: position.clone(), verticalVelocity: 0, onGround: false };
}

const segment = new THREE.Line3();
const box = new THREE.Box3();
const triPoint = new THREE.Vector3();
const capsulePoint = new THREE.Vector3();
const direction = new THREE.Vector3();
const delta = new THREE.Vector3();
const ray = new THREE.Ray();

/** Casts a ray against the collider and returns the closest hit point, if any. */
export function raycastCollider(
  collider: Collider,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDistance = Infinity
): THREE.Vector3 | null {
  ray.origin.copy(origin);
  ray.direction.copy(dir).normalize();
  const hit = collider.bvh.raycastFirst(ray, THREE.DoubleSide, 0, maxDistance);
  return hit ? hit.point.clone() : null;
}

/** Height of the floor below a point, or null if there is none within maxDrop. */
export function floorHeightBelow(
  collider: Collider,
  point: THREE.Vector3,
  maxDrop = 50
): number | null {
  const hit = raycastCollider(collider, point, new THREE.Vector3(0, -1, 0), maxDrop);
  return hit ? hit.y : null;
}

/**
 * Advances the walker by `dt` seconds. `move` is the desired horizontal displacement per second
 * in world space (y is ignored). The capsule is pushed out of every triangle it overlaps, which
 * gives wall sliding and ground contact for free. Without a collider the walker moves freely.
 */
export function stepWalker(
  state: WalkerState,
  move: THREE.Vector3,
  dt: number,
  collider: Collider | null,
  params: WalkParams = DEFAULT_WALK_PARAMS
): void {
  const steps = Math.max(1, Math.ceil(dt / params.maxStep));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) stepOnce(state, move, h, collider, params);
}

function stepOnce(
  state: WalkerState,
  move: THREE.Vector3,
  dt: number,
  collider: Collider | null,
  params: WalkParams
): void {
  if (!collider) {
    state.position.x += move.x * dt;
    state.position.z += move.z * dt;
    state.onGround = false;
    return;
  }

  state.verticalVelocity += state.onGround ? 0 : params.gravity * dt;
  state.position.x += move.x * dt;
  state.position.z += move.z * dt;
  state.position.y += state.verticalVelocity * dt;
  const intended = state.position.clone();

  const { radius, height } = params;
  segment.start.set(state.position.x, state.position.y + radius, state.position.z);
  segment.end.set(state.position.x, state.position.y + height - radius, state.position.z);
  box.makeEmpty();
  box.expandByPoint(segment.start);
  box.expandByPoint(segment.end);
  box.min.addScalar(-radius);
  box.max.addScalar(radius);

  collider.bvh.shapecast({
    intersectsBounds: b => b.intersectsBox(box),
    intersectsTriangle: tri => {
      const distance = tri.closestPointToSegment(segment, triPoint, capsulePoint);
      if (distance < radius) {
        const depth = radius - distance;
        direction.subVectors(capsulePoint, triPoint).normalize();
        segment.start.addScaledVector(direction, depth);
        segment.end.addScaledVector(direction, depth);
      }
      return false;
    },
  });

  const resolved = new THREE.Vector3(segment.start.x, segment.start.y - radius, segment.start.z);
  delta.subVectors(resolved, intended);
  // Pushed upwards by more than a fraction of what gravity moved us: standing on something.
  state.onGround = delta.y > Math.abs(dt * state.verticalVelocity * 0.25);
  state.position.copy(resolved);
  if (state.onGround) {
    state.verticalVelocity = 0;
  } else if (delta.y < -1e-5 && state.verticalVelocity > 0) {
    // Bumped the head on a ceiling.
    state.verticalVelocity = 0;
  }
}

/**
 * Picks a sensible place to stand: a point on the floor near the middle of the room, in the lower
 * part of the mesh where a person could actually be, with plenty of open space around. Returns the
 * feet position, or null if none was found.
 */
export function findStartSpot(collider: Collider, params: WalkParams = DEFAULT_WALK_PARAMS) {
  const { min, max } = collider.bounds;
  const center = collider.bounds.getCenter(new THREE.Vector3());
  const castFromY = min.y + (max.y - min.y) * 0.45;
  const candidates: { spot: THREE.Vector3; fromCenter: number }[] = [];
  for (let x = min.x + 0.5; x < max.x - 0.5; x += 0.5) {
    for (let z = min.z + 0.5; z < max.z - 0.5; z += 0.5) {
      const floor = floorHeightBelow(collider, new THREE.Vector3(x, castFromY, z));
      if (floor === null || floor > min.y + (max.y - min.y) * 0.5) continue;
      // Needs room above the head so we do not start inside a ceiling-high object.
      const head = new THREE.Vector3(x, floor + 0.1, z);
      if (raycastCollider(collider, head, new THREE.Vector3(0, 1, 0), params.height)) continue;
      candidates.push({
        spot: new THREE.Vector3(x, floor, z),
        fromCenter: Math.hypot(x - center.x, z - center.z),
      });
    }
  }
  candidates.sort((a, b) => a.fromCenter - b.fromCenter);

  // Among the spots closest to the middle, prefer the one with the most open space around it.
  let best: THREE.Vector3 | null = null;
  let bestScore = -Infinity;
  const dir = new THREE.Vector3();
  for (const { spot, fromCenter } of candidates.slice(0, 60)) {
    const eye = new THREE.Vector3(spot.x, spot.y + params.eyeHeight, spot.z);
    let openness = 0;
    for (let i = 0; i < 12; i++) {
      const yaw = (i / 12) * Math.PI * 2;
      dir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      const hit = raycastCollider(collider, eye, dir, 6);
      openness += hit ? hit.distanceTo(eye) : 6;
    }
    const score = openness / 12 - 0.15 * fromCenter;
    if (score > bestScore) {
      bestScore = score;
      best = spot;
    }
  }
  return best;
}

/**
 * Viewing direction (yaw, as used by WalkControls) with the most free space ahead of the given
 * eye position, so the first steps do not run straight into a wall or a piece of furniture.
 */
export function mostOpenYaw(collider: Collider, eye: THREE.Vector3, samples = 24): number {
  let bestYaw = 0;
  let bestDistance = -1;
  const dir = new THREE.Vector3();
  for (let i = 0; i < samples; i++) {
    const yaw = (i / samples) * Math.PI * 2;
    dir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    const hit = raycastCollider(collider, eye, dir, 50);
    const distance = hit ? hit.distanceTo(eye) : 50;
    if (distance > bestDistance) {
      bestDistance = distance;
      bestYaw = yaw;
    }
  }
  return bestYaw;
}

/** Whether a body of the given height fits above the feet without touching a ceiling or shelf. */
export function hasHeadroom(
  collider: Collider | null,
  feet: THREE.Vector3,
  height: number
): boolean {
  if (!collider) return true;
  const lift = 0.1;
  const origin = new THREE.Vector3(feet.x, feet.y + lift, feet.z);
  return !raycastCollider(collider, origin, new THREE.Vector3(0, 1, 0), height - lift);
}
