import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { segmentContains, segmentObjectAt, segmentVolume } from './objectSegment';
import { createCollider } from './walkPhysics';

/**
 * A 6 x 6 m floor at y = 0 and a 3 m high wall along z = -3, both finely tessellated like a
 * reconstructed mesh, plus a box (0.8 x 0.9 x 0.5 m) standing on the floor.
 */
function makeScene(box: { x: number; z: number; yaw?: number }) {
  const root = new THREE.Group();
  const floor = new THREE.PlaneGeometry(6, 6, 60, 60).rotateX(-Math.PI / 2);
  const wall = new THREE.PlaneGeometry(6, 3, 60, 30).translate(0, 1.5, -3);
  const object = new THREE.BoxGeometry(0.8, 0.9, 0.5, 8, 9, 5)
    .rotateY(box.yaw ?? 0)
    .translate(box.x, 0.45, box.z);
  for (const geometry of [floor, wall, object]) root.add(new THREE.Mesh(geometry));
  return createCollider(root);
}

const sortedHalves = (half: THREE.Vector3) => [half.x, half.y, half.z].sort((a, b) => a - b);

describe('segmentObjectAt', () => {
  it('cuts a box standing on the floor out of the mesh', () => {
    const collider = makeScene({ x: 0.5, z: -1 });
    const segment = segmentObjectAt(collider, new THREE.Vector3(0.5, 0.9, -1));
    expect(segment.method).toBe('mesh');
    const [small, mid, large] = sortedHalves(segment.halfExtents);
    expect(small).toBeCloseTo(0.25, 1);
    expect(mid).toBeCloseTo(0.4, 1);
    expect(large).toBeCloseTo(0.45, 1);
    expect(segment.center.x).toBeCloseTo(0.5, 1);
    expect(segment.center.z).toBeCloseTo(-1, 1);
    // The side of the box is on the object, the floor a metre away is not.
    expect(segmentContains(segment, new THREE.Vector3(0.9, 0.4, -1))).toBe(true);
    expect(segmentContains(segment, new THREE.Vector3(1.5, 0, -1))).toBe(false);
  });

  it('finds the same object from the side as from the top', () => {
    const collider = makeScene({ x: 0.5, z: -1 });
    const fromTop = segmentObjectAt(collider, new THREE.Vector3(0.5, 0.9, -1));
    const fromSide = segmentObjectAt(collider, new THREE.Vector3(0.9, 0.5, -1));
    expect(fromSide.method).toBe('mesh');
    expect(fromSide.center.distanceTo(fromTop.center)).toBeLessThan(0.05);
    expect(segmentVolume(fromSide)).toBeCloseTo(segmentVolume(fromTop), 1);
  });

  it('follows an object that is turned in the room', () => {
    const collider = makeScene({ x: -0.5, z: 0.5, yaw: Math.PI / 6 });
    const segment = segmentObjectAt(collider, new THREE.Vector3(-0.5, 0.9, 0.5));
    expect(segment.method).toBe('mesh');
    const [small, mid, large] = sortedHalves(segment.halfExtents);
    expect(small).toBeCloseTo(0.25, 1);
    expect(mid).toBeCloseTo(0.4, 1);
    expect(large).toBeCloseTo(0.45, 1);
    // A corner of the turned box is inside, the corner of the unturned footprint is not.
    expect(
      segmentContains(
        segment,
        new THREE.Vector3(
          -0.5 + 0.4 * Math.cos(Math.PI / 6),
          0.4,
          0.5 - 0.4 * Math.sin(Math.PI / 6)
        )
      )
    ).toBe(true);
  });

  it('does not take the wall along when the object stands against it', () => {
    const collider = makeScene({ x: 0, z: -2.75 });
    const segment = segmentObjectAt(collider, new THREE.Vector3(0, 0.9, -2.75));
    expect(segment.method).toBe('mesh');
    expect(Math.max(segment.halfExtents.x, segment.halfExtents.z)).toBeLessThan(0.6);
    expect(segment.halfExtents.y).toBeLessThan(0.6);
  });

  it('falls back to a small box on the bare floor', () => {
    const collider = makeScene({ x: 0.5, z: -1 });
    const segment = segmentObjectAt(collider, new THREE.Vector3(-1.5, 0, 1.5));
    expect(segment.method).toBe('fallback');
    expect(segment.halfExtents.toArray()).toEqual([0.25, 0.25, 0.25]);
  });

  it('falls back to a thin upright box on a bare wall', () => {
    const collider = makeScene({ x: 0.5, z: -1 });
    const segment = segmentObjectAt(collider, new THREE.Vector3(-1.5, 1.5, -3));
    expect(segment.method).toBe('fallback');
    expect(segment.halfExtents.z).toBeLessThan(0.1);
    // The thin side faces the room: a point in front of the wall is hit, one far away is not.
    expect(segmentContains(segment, new THREE.Vector3(-1.5, 1.5, -2.97))).toBe(true);
    expect(segmentContains(segment, new THREE.Vector3(-1.5, 1.5, -2.5))).toBe(false);
  });
});
