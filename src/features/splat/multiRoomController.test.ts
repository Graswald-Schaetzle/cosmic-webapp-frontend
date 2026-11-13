import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { SpaceRoom, SpaceRooms } from '../../api/spaces/spacesApi';
import { MultiRoomController, MultiRoomStatus, RoomUnit } from './multiRoomController';
import { IDENTITY_PLACEMENT } from './spaceFrame';

const FLOOR = -1.4;
const v = (x: number, z: number) => new THREE.Vector3(x, FLOOR, z);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

const room = (room_id: number, x: number, overrides: Partial<SpaceRoom> = {}): SpaceRoom => ({
  room_id,
  name: `Room ${room_id}`,
  floor_id: 1,
  floor_name: 'Ground floor',
  floor_sequence: 0,
  status: 'completed',
  job_id: 100 + room_id,
  splat_url: `https://example.test/${room_id}/splat.spz`,
  collision_url: null,
  room_frame: {
    scale: 1,
    rotation_deg: [0, 0, 0],
    translation: [x, 0, 0],
    source: x === 0 ? 'start' : 'doors',
  },
  captured_at: null,
  ...overrides,
});

/** Three rooms in a row along X, 4 m each, doors at x = 4 and x = 8 (z = 2). */
const threeRooms = (): SpaceRooms => ({
  space_id: 1,
  start_room_id: null,
  effective_start_room_id: 1,
  rooms: [room(1, 0), room(2, 4), room(3, 8)],
  connections: [
    {
      connection_id: 1,
      from_room_id: 1,
      to_room_id: 2,
      from_door: { position: [4, FLOOR, 2], normal: [1, 0, 0] },
      to_door: { position: [0, FLOOR, 2], normal: [1, 0, 0] },
    },
    {
      connection_id: 2,
      from_room_id: 2,
      to_room_id: 3,
      from_door: { position: [4, FLOOR, 2], normal: [1, 0, 0] },
      to_door: { position: [0, FLOOR, 2], normal: [1, 0, 0] },
    },
  ],
});

interface FakeUnit extends RoomUnit {
  roomId: number;
  jobId: number | null;
  visible: boolean;
  disposed: boolean;
  finish(): void;
  fail(): void;
}

function harness(autoLoad = true) {
  const units: FakeUnit[] = [];
  const statuses: MultiRoomStatus[] = [];
  const controller = new MultiRoomController(
    spaceRoom => {
      let resolve!: (box: THREE.Box3) => void;
      let reject!: (error: Error) => void;
      const ready = new Promise<THREE.Box3>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // Every fake splat spans 4 x 4 m in its own coordinates.
      const box = new THREE.Box3(new THREE.Vector3(0, FLOOR, 0), new THREE.Vector3(4, 1.1, 4));
      const unit: FakeUnit = {
        roomId: spaceRoom.room_id,
        jobId: spaceRoom.job_id,
        visible: true,
        disposed: false,
        ready,
        setMatrix: vi.fn(),
        setVisible(visible) {
          unit.visible = visible;
        },
        getCollider: () => null,
        dispose() {
          unit.disposed = true;
        },
        finish: () => resolve(box),
        fail: () => reject(new Error('download failed')),
      };
      if (autoLoad) unit.finish();
      units.push(unit);
      return unit;
    },
    status => statuses.push(status)
  );
  const live = () => units.filter(unit => !unit.disposed).map(unit => unit.roomId);
  const shown = () => units.filter(unit => !unit.disposed && unit.visible).map(unit => unit.roomId);
  return { controller, units, statuses, live, shown };
}

describe('MultiRoomController', () => {
  it('loads only the start room first', async () => {
    const { controller, live, shown } = harness();
    controller.setData(threeRooms(), IDENTITY_PLACEMENT);
    const pose = await controller.enter(1);
    expect(controller.currentRoomId).toBe(1);
    expect(live()).toEqual([1]);
    expect(shown()).toEqual([1]);
    // One door, the room was left through it: stand a few steps inside of it.
    expect(pose.feet.x).toBeCloseTo(2.2);
    // Arriving there does not load the room behind the door.
    controller.update(pose.feet);
    expect(live()).toEqual([1]);
    expect(pose.feet.y).toBeCloseTo(FLOOR);
  });

  it('loads a neighbour at its door, switches rooms behind it and drops rooms further away', async () => {
    const { controller, live, shown, statuses } = harness();
    controller.setData(threeRooms(), IDENTITY_PLACEMENT);
    await controller.enter(1);

    expect(controller.update(v(1, 2))).toBeNull();
    expect(live()).toEqual([1]);

    controller.update(v(3, 2));
    expect(live()).toEqual([1, 2]);
    expect(statuses[statuses.length - 1].loadingRoomIds).toEqual([2]);
    await tick();
    expect(statuses[statuses.length - 1].loadingRoomIds).toEqual([]);

    // Stepping back and forth at the door neither drops nor reloads the neighbour.
    controller.update(v(2.3, 2));
    controller.update(v(3, 2));
    expect(live()).toEqual([1, 2]);

    const entered = controller.update(v(4.5, 2));
    expect(entered).toEqual({ enteredRoomId: 2, floorY: FLOOR });
    expect(controller.currentRoomId).toBe(2);
    expect(shown()).toEqual([1, 2]);

    controller.update(v(7.5, 2));
    expect(live()).toEqual([1, 2, 3]);
    // Room 1's door is 3.5 m away: in memory, hidden.
    expect(shown()).toEqual([2, 3]);
    await tick();

    controller.update(v(8.5, 2));
    expect(controller.currentRoomId).toBe(3);
    expect(live()).toEqual([2, 3]);
  });

  it('keeps the previous room until the target of a jump has loaded', async () => {
    const { controller, units, live, shown } = harness(false);
    controller.setData(threeRooms(), IDENTITY_PLACEMENT);
    const start = controller.enter(1);
    units[0].finish();
    await start;
    controller.update(v(1, 2));

    const jump = controller.enter(3);
    controller.update(v(1, 2));
    expect(controller.currentRoomId).toBe(1);
    expect(live()).toEqual([1, 3]);
    expect(shown()).toEqual([1]);

    units[1].finish();
    const pose = await jump;
    expect(controller.currentRoomId).toBe(3);
    expect(live()).toEqual([3]);
    expect(shown()).toEqual([3]);
    // In at the door from room 2 (x = 8), a few steps inside.
    expect(pose.feet.x).toBeCloseTo(9.8);
  });

  it('rejects a jump into a room that fails to load and tries again on the next jump', async () => {
    const { controller, units, live } = harness(false);
    controller.setData(threeRooms(), IDENTITY_PLACEMENT);
    const start = controller.enter(1);
    units[0].finish();
    await start;

    const jump = controller.enter(3);
    units[1].fail();
    await expect(jump).rejects.toThrow('download failed');
    expect(controller.currentRoomId).toBe(1);
    controller.update(v(1, 2));
    expect(live()).toEqual([1]);

    const retry = controller.enter(3);
    expect(units).toHaveLength(3);
    units[2].finish();
    await retry;
    expect(controller.currentRoomId).toBe(3);
  });

  it('shows a room without a frame alone and does not leave it on foot', async () => {
    const data = threeRooms();
    data.rooms[2].room_frame = null;
    const { controller, live, statuses } = harness();
    controller.setData(data, IDENTITY_PLACEMENT);
    await controller.enter(2);
    // At the door to room 3: no portal leads to a room without a frame, nothing loads.
    controller.update(v(7.5, 2));
    expect(live()).toEqual([2]);

    await controller.enter(3);
    expect(controller.isolated).toBe(true);
    expect(statuses[statuses.length - 1].isolated).toBe(true);
    expect(live()).toEqual([3]);
    expect(controller.update(v(-50, 2))).toBeNull();
    expect(controller.currentRoomId).toBe(3);
  });

  it('replaces only the room whose capture changed', async () => {
    const { controller, units, live } = harness();
    controller.setData(threeRooms(), IDENTITY_PLACEMENT);
    await controller.enter(1);
    controller.update(v(3, 2));
    await tick();
    expect(live()).toEqual([1, 2]);

    // The same data again (a refetch, possibly with freshly signed URLs): nothing reloads.
    const same = threeRooms();
    same.rooms[1].splat_url = 'https://example.test/2/splat.spz?signature=new';
    controller.setData(same, IDENTITY_PLACEMENT);
    expect(units).toHaveLength(2);

    const recaptured = threeRooms();
    recaptured.rooms[1].job_id = 999;
    controller.setData(recaptured, IDENTITY_PLACEMENT);
    expect(units).toHaveLength(3);
    expect(units[1].disposed).toBe(true);
    expect(units[0].disposed).toBe(false);
    expect(units[2].jobId).toBe(999);
    expect(live()).toEqual([1, 2]);
  });

  it('moves loaded rooms when the placement of the space changes', async () => {
    const { controller, units } = harness();
    controller.setData(threeRooms(), IDENTITY_PLACEMENT);
    await controller.enter(1);
    controller.setData(threeRooms(), { ...IDENTITY_PLACEMENT, translation: [0, 1, 0] });
    expect(units[0].setMatrix).toHaveBeenCalledTimes(1);
    expect(units).toHaveLength(1);
  });

  it('falls back to the start room when the current room disappears', async () => {
    const { controller, live } = harness();
    controller.setData(threeRooms(), IDENTITY_PLACEMENT);
    await controller.enter(1);
    controller.update(v(3, 2));
    controller.update(v(4.5, 2));
    expect(controller.currentRoomId).toBe(2);

    const without = threeRooms();
    without.rooms.splice(1, 1);
    without.connections = [];
    controller.setData(without, IDENTITY_PLACEMENT);
    expect(controller.currentRoomId).toBe(1);
    expect(live()).toEqual([1]);
  });

  it('frees every room on dispose', async () => {
    const { controller, units } = harness();
    controller.setData(threeRooms(), IDENTITY_PLACEMENT);
    await controller.enter(1);
    controller.update(v(3, 2));
    controller.dispose();
    expect(units.every(unit => unit.disposed)).toBe(true);
    expect(controller.update(v(3, 2))).toBeNull();
  });
});
