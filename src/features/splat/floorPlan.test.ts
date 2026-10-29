import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildFloorPlan,
  buildFloorPlanFromMesh,
  collectTriangles,
  createPlanView,
  findFloorAndCeiling,
} from './floorPlan';

/** A box seen from the inside (normals point into the room), with its floor at y = 0. */
function room(width: number, depth: number, height: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, height, depth).translate(0, height / 2, 0);
  const index = geometry.getIndex()!;
  for (let i = 0; i < index.count; i += 3) {
    const second = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, second);
  }
  return new THREE.Mesh(geometry);
}

const planOf = (...meshes: THREE.Mesh[]) => {
  const group = new THREE.Group();
  group.add(...meshes);
  return buildFloorPlan(group);
};

describe('findFloorAndCeiling', () => {
  it('finds the floor and the ceiling of a room', () => {
    const levels = findFloorAndCeiling(collectTriangles(new THREE.Group().add(room(6, 4, 2.6))));
    expect(levels?.floorY).toBeCloseTo(0, 1);
    expect(levels?.ceilingY).toBeCloseTo(2.6, 1);
  });

  it('finds no floor in a mesh without upward-facing surface', () => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 2));
    expect(findFloorAndCeiling(collectTriangles(new THREE.Group().add(wall)))).toBeNull();
  });
});

describe('buildFloorPlan', () => {
  it('outlines a room as one closed rectangle', () => {
    const plan = planOf(room(6, 4, 2.6))!;
    expect(plan.paths).toHaveLength(1);
    expect(plan.paths[0].closed).toBe(true);
    expect(plan.paths[0].points).toHaveLength(4);
    expect(plan.bounds.maxX - plan.bounds.minX).toBeCloseTo(6, 0);
    expect(plan.bounds.maxZ - plan.bounds.minZ).toBeCloseTo(4, 0);
    expect(plan.floorY).toBeCloseTo(0, 1);
  });

  it('squares up a turned room and reports the wall direction', () => {
    const mesh = room(6, 4, 2.6);
    mesh.rotation.y = THREE.MathUtils.degToRad(30);
    const plan = planOf(mesh)!;
    expect(plan.paths[0].points).toHaveLength(4);
    // Turning the mesh by +30 degrees about Y turns its walls to -30 degrees in the x/z plane.
    const turns = (plan.wallAngle + Math.PI / 6) / (Math.PI / 2);
    expect(Math.abs(turns - Math.round(turns))).toBeLessThan(0.02);
  });

  it('keeps a pillar as a hole and drops a speck of furniture', () => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.8).translate(0, 1.3, 0));
    const speck = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1).translate(1.5, 1.3, 1));
    const plan = planOf(room(6, 4, 2.6), pillar, speck)!;
    expect(plan.paths).toHaveLength(2);
  });

  it('is null for an empty mesh', () => {
    expect(buildFloorPlanFromMesh({ positions: [], indices: [] })).toBeNull();
  });
});

describe('createPlanView', () => {
  it('fits the plan into the box and maps points both ways', () => {
    const plan = planOf(room(6, 4, 2.6))!;
    const view = createPlanView(plan, 300, 230, 10);
    expect(view.width).toBeLessThanOrEqual(300 + 1e-6);
    expect(view.height).toBeLessThanOrEqual(230 + 1e-6);
    const [px, py] = view.toScreen(1.25, -0.75);
    const [x, z] = view.toPlan(px, py);
    expect(x).toBeCloseTo(1.25, 5);
    expect(z).toBeCloseTo(-0.75, 5);
  });

  it('keeps the walls horizontal and vertical on screen', () => {
    const mesh = room(6, 4, 2.6);
    mesh.rotation.y = THREE.MathUtils.degToRad(35);
    const plan = planOf(mesh)!;
    const view = createPlanView(plan, 300, 230, 10);
    const corners = plan.paths[0].points.map(([x, z]) => view.toScreen(x, z));
    const edges = corners.map((from, i) => {
      const to = corners[(i + 1) % corners.length];
      return [Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])];
    });
    // Within about 1.5 degrees of horizontal or vertical.
    for (const [dx, dy] of edges) expect(Math.min(dx, dy) / Math.max(dx, dy)).toBeLessThan(0.03);
  });
});
