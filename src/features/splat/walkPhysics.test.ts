import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  STANCES,
  createCollider,
  createWalkerState,
  findStartSpot,
  floorHeightBelow,
  hasHeadroom,
  jumpVelocity,
  mostOpenYaw,
  raycastCollider,
  stepWalker,
} from './walkPhysics';

/** A closed 4 x 4 m room, floor at y = -1, walls up to y = 1, as a thin box shell. */
function makeRoom(): THREE.Object3D {
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3)
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    return new THREE.Mesh(geometry);
  };
  const room = new THREE.Group();
  room.add(
    quad([-2, -1, -2], [2, -1, -2], [2, -1, 2], [-2, -1, 2]),
    quad([-2, -1, -2], [-2, 1, -2], [2, 1, -2], [2, -1, -2]),
    quad([-2, -1, 2], [2, -1, 2], [2, 1, 2], [-2, 1, 2]),
    quad([-2, -1, -2], [-2, -1, 2], [-2, 1, 2], [-2, 1, -2]),
    quad([2, -1, -2], [2, 1, -2], [2, 1, 2], [2, -1, 2])
  );
  return room;
}

const settle = (
  state: ReturnType<typeof createWalkerState>,
  collider: ReturnType<typeof createCollider>
) => {
  for (let i = 0; i < 60; i++) stepWalker(state, new THREE.Vector3(), 1 / 60, collider);
};

describe('walkPhysics', () => {
  const collider = createCollider(makeRoom());

  it('builds a collider with the right bounds', () => {
    expect(collider.bounds.min.y).toBeCloseTo(-1);
    expect(collider.bounds.max.x).toBeCloseTo(2);
  });

  it('measures the floor below a point', () => {
    expect(floorHeightBelow(collider, new THREE.Vector3(0, 0.5, 0))).toBeCloseTo(-1);
    expect(floorHeightBelow(collider, new THREE.Vector3(10, 0.5, 0))).toBeNull();
  });

  it('lands on the floor when dropped', () => {
    const walker = createWalkerState(new THREE.Vector3(0, 0, 0));
    settle(walker, collider);
    expect(walker.onGround).toBe(true);
    expect(walker.position.y).toBeCloseTo(-1, 1);
  });

  it('is stopped by every wall and never leaves the room', () => {
    for (let angle = 0; angle < 24; angle++) {
      const walker = createWalkerState(new THREE.Vector3(0, -0.98, 0));
      settle(walker, collider);
      const move = new THREE.Vector3(
        Math.cos(angle * (Math.PI / 12)),
        0,
        Math.sin(angle * (Math.PI / 12))
      ).multiplyScalar(3.6);
      for (let i = 0; i < 10 * 60; i++) stepWalker(walker, move, 1 / 60, collider);
      expect(Math.abs(walker.position.x)).toBeLessThanOrEqual(2.01);
      expect(Math.abs(walker.position.z)).toBeLessThanOrEqual(2.01);
      expect(walker.position.y).toBeGreaterThan(-1.2);
    }
  });

  it('slides along a wall instead of sticking to it', () => {
    const walker = createWalkerState(new THREE.Vector3(0, -0.98, 0));
    settle(walker, collider);
    // diagonal into the +x wall: x is blocked, z keeps moving
    for (let i = 0; i < 4 * 60; i++)
      stepWalker(walker, new THREE.Vector3(2, 0, 1), 1 / 60, collider);
    expect(walker.position.x).toBeGreaterThan(1.5);
    expect(walker.position.z).toBeGreaterThan(1.2);
  });

  it('moves freely without a collider', () => {
    const walker = createWalkerState(new THREE.Vector3());
    stepWalker(walker, new THREE.Vector3(2, 0, 0), 1, null);
    expect(walker.position.x).toBeCloseTo(2);
  });

  it('finds a start spot on the floor and an open viewing direction', () => {
    const spot = findStartSpot(collider);
    expect(spot).not.toBeNull();
    expect(spot!.y).toBeCloseTo(-1, 1);
    const yaw = mostOpenYaw(collider, new THREE.Vector3(spot!.x, spot!.y + 1.6, spot!.z));
    expect(Number.isFinite(yaw)).toBe(true);
  });

  it('raycasts against the mesh', () => {
    const hit = raycastCollider(collider, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    expect(hit?.z).toBeCloseTo(-2);
  });

  it('jumps about as high as configured and lands again', () => {
    const walker = createWalkerState(new THREE.Vector3(0, -0.98, 0));
    settle(walker, collider);
    const floorY = walker.position.y;
    walker.verticalVelocity = jumpVelocity();
    walker.onGround = false;
    let peak = floorY;
    for (let i = 0; i < 90; i++) {
      stepWalker(walker, new THREE.Vector3(), 1 / 60, collider);
      peak = Math.max(peak, walker.position.y);
    }
    expect(peak - floorY).toBeGreaterThan(0.5);
    expect(peak - floorY).toBeLessThan(0.7);
    expect(walker.position.y).toBeCloseTo(floorY, 1);
  });

  it('keeps lower stances lower than the capsule is wide, and slower', () => {
    expect(STANCES.crouch.height).toBeLessThan(STANCES.stand.height);
    expect(STANCES.prone.height).toBeLessThan(STANCES.crouch.height);
    expect(STANCES.prone.height).toBeGreaterThanOrEqual(0.5);
    expect(STANCES.prone.speedFactor).toBeLessThan(STANCES.crouch.speedFactor);
    expect(STANCES.crouch.eyeHeight).toBeLessThan(STANCES.crouch.height);
  });

  it('only lets the body get taller where there is room above', () => {
    const feet = new THREE.Vector3(0, -1, 0);
    // The room is open at the top.
    expect(hasHeadroom(collider, feet, STANCES.stand.height)).toBe(true);
    // A low shelf 1.3 m above the floor: crouching fits, standing does not.
    const shelf = new THREE.Mesh(new THREE.BufferGeometry());
    shelf.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, 0.3, -1, 1, 0.3, -1, 1, 0.3, 1, -1, 0.3, 1], 3)
    );
    shelf.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const low = createCollider(new THREE.Group().add(shelf));
    expect(hasHeadroom(low, feet, STANCES.stand.height)).toBe(false);
    expect(hasHeadroom(low, feet, STANCES.crouch.height)).toBe(true);
    expect(hasHeadroom(low, feet, STANCES.prone.height)).toBe(true);
    expect(hasHeadroom(null, feet, STANCES.stand.height)).toBe(true);
  });
});
