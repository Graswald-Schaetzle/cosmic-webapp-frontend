import * as THREE from 'three';
import { Collider, floorHeightBelow, raycastCollider } from './walkPhysics';

/** How far in front of a tag the camera comes to rest after a click, in metres. */
export const TAG_STANDOFF = 1;
/** Closer than the standoff plus this, the camera only turns to the tag instead of moving. */
const ALREADY_CLOSE_MARGIN = 0.3;
/** Clearance kept to a wall or piece of furniture when the way to the tag is blocked. */
const OBSTACLE_CLEARANCE = 0.4;
/** Shortest way that is still worth gliding when the way is blocked. */
const MIN_GLIDE = 0.3;

/**
 * Where to stand so the tag is about `standoff` metres ahead, on the side the camera comes from.
 * Returns the feet position, or null when the camera should only turn: it is close enough
 * already, or there is no floor to stand on at the spot. If something blocks the straight way
 * the camera stops in front of it.
 */
export function planTagApproach(
  collider: Collider | null,
  eye: THREE.Vector3,
  tag: THREE.Vector3,
  eyeHeight: number,
  standoff = TAG_STANDOFF
): THREE.Vector3 | null {
  const dx = eye.x - tag.x;
  const dz = eye.z - tag.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= standoff + ALREADY_CLOSE_MARGIN) return null;

  const goalX = tag.x + (dx / distance) * standoff;
  const goalZ = tag.z + (dz / distance) * standoff;
  if (!collider) return new THREE.Vector3(goalX, eye.y - eyeHeight, goalZ);

  // Look for the floor from just above the lower of tag and eye, so a ceiling or a lamp does not
  // get in the way.
  const top = Math.min(tag.y, eye.y) + 0.3;
  const floor = floorHeightBelow(collider, new THREE.Vector3(goalX, top, goalZ));
  if (floor === null) return null;

  const goalEye = new THREE.Vector3(goalX, floor + eyeHeight, goalZ);
  const way = goalEye.clone().sub(eye);
  const length = way.length();
  const blocked = raycastCollider(collider, eye, way, length);
  if (!blocked) return new THREE.Vector3(goalX, floor, goalZ);

  const reach = blocked.distanceTo(eye) - OBSTACLE_CLEARANCE;
  if (reach < MIN_GLIDE) return null;
  const stop = eye.clone().addScaledVector(way.normalize(), reach);
  const stopFloor = floorHeightBelow(collider, stop);
  return stopFloor === null ? null : new THREE.Vector3(stop.x, stopFloor, stop.z);
}
