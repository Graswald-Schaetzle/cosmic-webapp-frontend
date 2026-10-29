import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCollider } from './walkPhysics';
import { TAG_STANDOFF, planTagApproach } from './tagApproach';

const quad = (a: number[], b: number[], c: number[], d: number[]) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return new THREE.Mesh(geometry);
};

/** A 10 x 4 m floor at y = 0, optionally with a wall across it at x = 0. */
function makeHall(withWall: boolean) {
  const group = new THREE.Group();
  group.add(quad([-5, 0, -2], [5, 0, -2], [5, 0, 2], [-5, 0, 2]));
  if (withWall) group.add(quad([0, 0, -2], [0, 3, -2], [0, 3, 2], [0, 0, 2]));
  return createCollider(group);
}

const EYE_HEIGHT = 1.6;

describe('planTagApproach', () => {
  it('stands the standoff in front of the tag, on the side we come from, on the floor', () => {
    const collider = makeHall(false);
    const eye = new THREE.Vector3(-4, EYE_HEIGHT, 0);
    const tag = new THREE.Vector3(3, 1.2, 0.5);
    const feet = planTagApproach(collider, eye, tag, EYE_HEIGHT)!;
    expect(feet.y).toBeCloseTo(0);
    expect(Math.hypot(feet.x - tag.x, feet.z - tag.z)).toBeCloseTo(TAG_STANDOFF);
    expect(feet.x).toBeLessThan(tag.x);
  });

  it('only turns when the tag is already within reach', () => {
    const collider = makeHall(false);
    const eye = new THREE.Vector3(1.8, EYE_HEIGHT, 0);
    expect(planTagApproach(collider, eye, new THREE.Vector3(3, 1.2, 0), EYE_HEIGHT)).toBeNull();
  });

  it('stops in front of an obstacle on the way', () => {
    const collider = makeHall(true);
    const eye = new THREE.Vector3(-4, EYE_HEIGHT, 0);
    const feet = planTagApproach(collider, eye, new THREE.Vector3(3, 1.2, 0), EYE_HEIGHT)!;
    expect(feet.x).toBeLessThan(0);
    expect(feet.x).toBeGreaterThan(-1);
  });

  it('keeps the height without a collision mesh', () => {
    const eye = new THREE.Vector3(0, 2.6, 0);
    const feet = planTagApproach(null, eye, new THREE.Vector3(5, 3, 0), EYE_HEIGHT)!;
    expect(feet.y).toBeCloseTo(1);
    expect(feet.x).toBeCloseTo(4);
  });
});
