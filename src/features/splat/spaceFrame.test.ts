import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyFrameDelta,
  floorAlignment,
  matrixToPlacement,
  originAlignment,
  placementToMatrix,
  resolvePlacement,
  scaleFromReference,
  SplatPlacement,
} from './spaceFrame';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const expectVector = (actual: THREE.Vector3, expected: THREE.Vector3) => {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
  expect(actual.z).toBeCloseTo(expected.z, 5);
};

describe('resolvePlacement', () => {
  it('uses the frame when there is one', () => {
    const splat: SplatPlacement = { scale: 2, rotation_deg: [0, 90, 0], translation: [1, 2, 3] };
    expect(resolvePlacement({ version: 2, unit: 'm', up: 'y', splat }, null)).toBe(splat);
  });

  it('falls back to the legacy rotation without scale or translation', () => {
    expect(resolvePlacement(null, { rotation_deg: [180, 0, 0] })).toEqual({
      scale: 1,
      rotation_deg: [180, 0, 0],
      translation: [0, 0, 0],
    });
    expect(resolvePlacement(null, null).rotation_deg).toEqual([0, 0, 0]);
  });
});

describe('placement matrices', () => {
  it('round-trips through a matrix', () => {
    const placement: SplatPlacement = {
      scale: 1.75,
      rotation_deg: [20, -35, 70],
      translation: [1, -2, 0.5],
    };
    const back = matrixToPlacement(placementToMatrix(placement));
    expect(back.scale).toBeCloseTo(placement.scale, 5);
    back.rotation_deg.forEach((a, i) => expect(a).toBeCloseTo(placement.rotation_deg[i], 4));
    back.translation.forEach((t, i) => expect(t).toBeCloseTo(placement.translation[i], 5));
  });

  it('flips Y and Z for 180 degrees about X, as the legacy rotation did', () => {
    const m = placementToMatrix({ scale: 1, rotation_deg: [180, 0, 0], translation: [0, 0, 0] });
    expectVector(v(1, 2, 3).applyMatrix4(m), v(1, -2, -3));
  });
});

describe('floorAlignment', () => {
  it('levels a tilted floor onto y = 0 and keeps it pointing up', () => {
    // A floor tilted 10 degrees about X and sitting 3 m above the origin.
    const tilt = new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(10));
    const points = [v(-2, 0, -2), v(2, 0, -1), v(0, 0, 3)].map(p =>
      p.applyMatrix4(tilt).add(v(0, 3, 0))
    );
    const delta = floorAlignment(points)!;
    for (const point of points) expect(point.clone().applyMatrix4(delta).y).toBeCloseTo(0, 5);
    // Up stays up: a point above the floor ends up above y = 0.
    const above = v(0, 1, 0)
      .applyMatrix4(tilt)
      .add(v(0, 3, 0));
    expect(above.applyMatrix4(delta).y).toBeGreaterThan(0.5);
  });

  it('handles the upside-down case: floor picked on a flipped model', () => {
    const points = [v(0, 2, 0), v(1, 2, 0), v(0, 2, 1)];
    const delta = floorAlignment(points)!;
    for (const point of points) expect(point.clone().applyMatrix4(delta).y).toBeCloseTo(0, 5);
  });

  it('rejects collinear points and walls', () => {
    expect(floorAlignment([v(0, 0, 0), v(1, 0, 0), v(2, 0, 0)])).toBeNull();
    expect(floorAlignment([v(0, 0, 0), v(1, 0, 0), v(0, 1, 0)])).toBeNull();
    expect(floorAlignment([v(0, 0, 0), v(1, 0, 0)])).toBeNull();
  });
});

describe('scaleFromReference', () => {
  it('scales two points to the stated distance', () => {
    const a = v(0, 0, 0);
    const b = v(0, 1.025, 0);
    const delta = scaleFromReference([a, b], 2.05)!;
    expect(a.clone().applyMatrix4(delta).distanceTo(b.clone().applyMatrix4(delta))).toBeCloseTo(
      2.05,
      5
    );
  });

  it('rejects zero distances and lengths', () => {
    expect(scaleFromReference([v(1, 1, 1), v(1, 1, 1)], 2)).toBeNull();
    expect(scaleFromReference([v(0, 0, 0), v(1, 0, 0)], 0)).toBeNull();
    expect(scaleFromReference([v(0, 0, 0)], 2)).toBeNull();
  });
});

describe('originAlignment', () => {
  it('puts the origin on the Y axis and the second point on +X', () => {
    const origin = v(3, -1, 2);
    const direction = v(3, 0.5, 7);
    const delta = originAlignment([origin, direction])!;
    expectVector(origin.clone().applyMatrix4(delta), v(0, -1, 0));
    const moved = direction.clone().applyMatrix4(delta);
    expect(moved.x).toBeCloseTo(5, 5);
    expect(moved.z).toBeCloseTo(0, 5);
    expect(moved.y).toBeCloseTo(0.5, 5);
  });

  it('rejects a direction straight above the origin', () => {
    expect(originAlignment([v(1, 0, 1), v(1, 4, 1)])).toBeNull();
  });
});

describe('applyFrameDelta', () => {
  it('moves the model the way the delta moves points', () => {
    const before: SplatPlacement = { scale: 1, rotation_deg: [180, 0, 0], translation: [0, 0, 0] };
    const delta = scaleFromReference([v(0, 0, 0), v(0, 1, 0)], 2)!;
    const after = applyFrameDelta(before, delta);
    const source = v(0.3, -1.1, 2.4);
    const expected = source.clone().applyMatrix4(placementToMatrix(before)).applyMatrix4(delta);
    expectVector(source.clone().applyMatrix4(placementToMatrix(after)), expected);
    expect(after.scale).toBeCloseTo(2, 5);
  });
});
