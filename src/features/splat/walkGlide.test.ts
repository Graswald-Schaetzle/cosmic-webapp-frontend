import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { WalkControls } from './WalkControls';

describe('WalkControls.flyTo', () => {
  beforeEach(() => {
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('window', target);
    vi.stubGlobal('document', { ...target, pointerLockElement: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  const setup = () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    const element = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const walk = new WalkControls(camera, element as unknown as HTMLElement);
    return { camera, walk };
  };

  const run = (walk: WalkControls, seconds: number) => {
    for (let i = 0; i < seconds * 60; i++) walk.update(1 / 60);
  };

  it('glides to the spot and ends looking at the point', () => {
    const { camera, walk } = setup();
    const tag = new THREE.Vector3(0, 1.0, -6);
    walk.flyTo(new THREE.Vector3(0, 0, -5), tag);
    expect(walk.gliding).toBe(true);
    run(walk, 4);
    expect(walk.gliding).toBe(false);
    expect(camera.position.z).toBeCloseTo(-5, 1);
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const toTag = tag.clone().sub(camera.position).normalize();
    expect(direction.dot(toTag)).toBeGreaterThan(0.999);
  });

  it('turns the short way round when the tag is behind', () => {
    const { camera, walk } = setup();
    walk.yaw = Math.PI * 0.9;
    walk.flyTo(null, new THREE.Vector3(3, 1.6, 0));
    run(walk, 2);
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    expect(direction.x).toBeGreaterThan(0.999);
  });

  it('is taken over by a key press', () => {
    const { walk } = setup();
    walk.flyTo(new THREE.Vector3(0, 0, -5), new THREE.Vector3(0, 1, -6));
    walk.moveInput.set(0, 1);
    walk.update(1 / 60);
    expect(walk.gliding).toBe(false);
  });
});
