import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { RoomConnection, RoomFrame, SpaceRoom, SpaceRooms } from '../../api/spaces/spacesApi';
import {
  DOOR_CROSS_HYSTERESIS_M,
  MAX_ROOMS_IN_MEMORY,
  ROOM_ENTRY_INSET_M,
  ROOM_ENTRY_INSET_SMALL_M,
  buildRoomLayout,
  chooseStartRoom,
  composeRoomMatrix,
  doorToSpace,
  groupRoomsByFloor,
  hasViewableRooms,
  resolveCurrentRoom,
  roomEntryPose,
  stepRooms,
} from './roomLayout';
import { IDENTITY_PLACEMENT, SplatPlacement, placementToMatrix } from './spaceFrame';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const expectVector = (actual: THREE.Vector3, expected: THREE.Vector3) => {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
  expect(actual.z).toBeCloseTo(expected.z, 5);
};

const frame = (
  translation: [number, number, number] = [0, 0, 0],
  rotationY = 0,
  source: RoomFrame['source'] = 'doors'
): RoomFrame => ({ scale: 1, rotation_deg: [0, rotationY, 0], translation, source });

const room = (room_id: number, overrides: Partial<SpaceRoom> = {}): SpaceRoom => ({
  room_id,
  name: `Room ${room_id}`,
  floor_id: 1,
  floor_name: 'Ground floor',
  floor_sequence: 0,
  status: 'completed',
  job_id: 100 + room_id,
  splat_url: `https://example.test/${room_id}/splat.spz`,
  collision_url: null,
  room_frame: frame(),
  captured_at: null,
  ...overrides,
});

const spaceRooms = (rooms: SpaceRoom[], connections: RoomConnection[] = []): SpaceRooms => ({
  space_id: 1,
  start_room_id: null,
  effective_start_room_id: rooms[0]?.room_id ?? null,
  rooms,
  connections,
});

/**
 * Room 1 (start, identity) spans x 0..4, room 2 lies east of it (x 4..8), both z 0..4, floor at
 * y = -1.4. The door is at x = 4, z = 2 and leads in +X. Room 2 was captured in its own
 * coordinates, shifted by 4 m; its frame moves it into place.
 */
const FLOOR = -1.4;
const twoRooms = () =>
  spaceRooms(
    [
      room(1, { room_frame: frame([0, 0, 0], 0, 'start') }),
      room(2, { room_frame: frame([4, 0, 0]) }),
    ],
    [
      {
        connection_id: 5,
        from_room_id: 1,
        to_room_id: 2,
        from_door: { position: [4, FLOOR, 2], normal: [1, 0, 0] },
        to_door: { position: [0, FLOOR, 2], normal: [1, 0, 0] },
      },
    ]
  );
const BOUNDS = new Map([
  [1, new THREE.Box3(v(0, FLOOR, 0), v(4, 1.1, 4))],
  [2, new THREE.Box3(v(4, FLOOR, 0), v(8, 1.1, 4))],
]);
const NONE = new Set<number>();

describe('composeRoomMatrix', () => {
  it('applies the room frame first, then the space placement', () => {
    const space: SplatPlacement = { scale: 2, rotation_deg: [0, 90, 0], translation: [10, 0, 0] };
    const roomFrame = frame([1, 0, 0], 0);
    const point = v(1, 0, 0).applyMatrix4(composeRoomMatrix(space, roomFrame));
    // room frame: (2, 0, 0); scaled: (4, 0, 0); rotated 90 deg about Y: (0, 0, -4); moved.
    expectVector(point, v(10, 0, -4));
  });

  it('is the space placement alone for a room without a usable frame', () => {
    const space: SplatPlacement = { scale: 1, rotation_deg: [0, 0, 0], translation: [1, 2, 3] };
    const expected = placementToMatrix(space);
    expect(composeRoomMatrix(space, null).equals(expected)).toBe(true);
    const broken = { ...frame(), scale: Number.NaN };
    expect(composeRoomMatrix(space, broken).equals(expected)).toBe(true);
  });
});

describe('doorToSpace', () => {
  it('moves the position and turns the normal, keeping it horizontal and of unit length', () => {
    const matrix = composeRoomMatrix(IDENTITY_PLACEMENT, frame([4, 0, 0], 90));
    const door = doorToSpace(
      { position: [1, FLOOR, 0], normal: [0, 0, -2], width_m: 1.2 },
      matrix
    )!;
    expectVector(door.position, v(4, FLOOR, -1));
    expectVector(door.normal, v(-1, 0, 0));
    expect(door.width).toBeCloseTo(1.2);
  });

  it('rejects unusable doors instead of producing NaN', () => {
    const identity = new THREE.Matrix4();
    expect(doorToSpace(null, identity)).toBeNull();
    expect(doorToSpace({ position: [0, 0, 0], normal: [0, 1, 0] }, identity)).toBeNull();
    expect(doorToSpace({ position: [0, Number.NaN, 0], normal: [1, 0, 0] }, identity)).toBeNull();
    expect(doorToSpace({ position: [0, 0, 0], normal: [1, 0, 0] }, identity)!.width).toBe(0.9);
  });
});

describe('buildRoomLayout', () => {
  it('places both doors of a connection at the same spot when the frame fits', () => {
    const layout = buildRoomLayout(twoRooms(), IDENTITY_PLACEMENT);
    expect(layout.portals).toHaveLength(1);
    expectVector(layout.portals[0].position, v(4, FLOOR, 2));
    expectVector(layout.portals[0].normal, v(1, 0, 0));
    expectVector(layout.rooms.get(2)!.doors[0].door.position, v(4, FLOOR, 2));
    expectVector(layout.rooms.get(1)!.doors[0].inward, v(-1, 0, 0));
    expectVector(layout.rooms.get(2)!.doors[0].inward, v(1, 0, 0));
  });

  it('leaves out rooms without a splat and makes no portal to a room without a frame', () => {
    const data = twoRooms();
    data.rooms[1].room_frame = null;
    data.rooms.push(room(3, { status: 'processing', splat_url: null, job_id: null }));
    const layout = buildRoomLayout(data, IDENTITY_PLACEMENT);
    expect([...layout.rooms.keys()]).toEqual([1, 2]);
    expect(layout.rooms.get(2)!.placed).toBe(false);
    expect(layout.portals).toHaveLength(0);
    // The unplaced room still knows its own door, for the jump into it.
    expect(layout.rooms.get(2)!.doors).toHaveLength(1);
  });
});

describe('chooseStartRoom', () => {
  it('prefers the configured room, then the automatic one', () => {
    const data = twoRooms();
    expect(chooseStartRoom(data)).toBe(1);
    data.start_room_id = 2;
    expect(chooseStartRoom(data)).toBe(2);
  });

  it('skips a start room without a finished splat', () => {
    const data = twoRooms();
    data.start_room_id = 3;
    data.effective_start_room_id = 3;
    data.rooms.unshift(room(3, { status: 'failed', splat_url: null }));
    expect(chooseStartRoom(data)).toBe(1);
  });

  it('is null for a space without room captures', () => {
    expect(chooseStartRoom(spaceRooms([]))).toBeNull();
    expect(chooseStartRoom(null)).toBeNull();
    expect(hasViewableRooms(spaceRooms([]))).toBe(false);
    expect(hasViewableRooms(spaceRooms([room(1, { status: 'processing', splat_url: null })]))).toBe(
      false
    );
    expect(hasViewableRooms(twoRooms())).toBe(true);
  });
});

describe('groupRoomsByFloor', () => {
  it('orders floors by sequence and puts rooms without a floor last', () => {
    const groups = groupRoomsByFloor([
      room(1, { floor_id: null, floor_name: null, floor_sequence: null }),
      room(2, { floor_id: 8, floor_name: 'First floor', floor_sequence: 1 }),
      room(3),
      room(4),
    ]);
    expect(groups.map(g => g.name)).toEqual(['Ground floor', 'First floor', null]);
    expect(groups[0].rooms.map(r => r.room_id)).toEqual([3, 4]);
  });
});

describe('resolveCurrentRoom', () => {
  const layout = buildRoomLayout(twoRooms(), IDENTITY_PLACEMENT);

  it('changes room behind the door plane, with hysteresis in both directions', () => {
    const at = (x: number, from: number) =>
      resolveCurrentRoom(layout, from, v(x, FLOOR, 2), BOUNDS).roomId;
    expect(at(3.5, 1)).toBe(1);
    expect(at(4 + DOOR_CROSS_HYSTERESIS_M - 0.05, 1)).toBe(1);
    expect(at(4 + DOOR_CROSS_HYSTERESIS_M + 0.05, 1)).toBe(2);
    // Stepping back onto the threshold does not flip back.
    expect(at(4.1, 2)).toBe(2);
    expect(at(3.9, 2)).toBe(2);
    expect(at(4 - DOOR_CROSS_HYSTERESIS_M - 0.05, 2)).toBe(1);
  });

  it('reports the door that was walked through', () => {
    const result = resolveCurrentRoom(layout, 1, v(4.5, FLOOR, 2), BOUNDS);
    expect(result.through?.connectionId).toBe(5);
  });

  it('ignores a door on another floor', () => {
    expect(resolveCurrentRoom(layout, 1, v(4.5, FLOOR + 3, 2), new Map()).roomId).toBe(1);
  });

  it('falls back to the bounds when the camera went through a wall', () => {
    // Far from the door opening (z = 0.3), but clearly inside room 2.
    expect(resolveCurrentRoom(layout, 1, v(6, FLOOR, 0.3), BOUNDS).roomId).toBe(2);
    // Just outside the wall, within the margin: still room 1.
    expect(resolveCurrentRoom(layout, 1, v(4.3, FLOOR, 0.3), BOUNDS).roomId).toBe(1);
  });

  it('falls back to the nearest door when the room behind it is not loaded', () => {
    const onlyFirst = new Map([[1, BOUNDS.get(1)!]]);
    expect(resolveCurrentRoom(layout, 1, v(6, FLOOR, 0.3), onlyFirst).roomId).toBe(2);
    // Outside on the other side of the room: no door plane passed, stays.
    expect(resolveCurrentRoom(layout, 1, v(-3, FLOOR, 2), onlyFirst).roomId).toBe(1);
  });

  it('stays put when rooms overlap because a frame is off', () => {
    const overlapping = new Map([
      [1, BOUNDS.get(1)!],
      [2, new THREE.Box3(v(1, FLOOR, 0), v(5, 1.1, 4))],
    ]);
    // Beside the door opening, inside both boxes.
    expect(resolveCurrentRoom(layout, 1, v(2, FLOOR, 0.3), overlapping).roomId).toBe(1);
    expect(resolveCurrentRoom(layout, 2, v(2, FLOOR, 0.3), overlapping).roomId).toBe(2);
  });

  it('never leaves a room without a frame by walking', () => {
    const data = twoRooms();
    data.rooms[1].room_frame = null;
    const isolated = buildRoomLayout(data, IDENTITY_PLACEMENT);
    expect(resolveCurrentRoom(isolated, 2, v(-20, FLOOR, 2), BOUNDS).roomId).toBe(2);
  });
});

describe('stepRooms', () => {
  const layout = buildRoomLayout(twoRooms(), IDENTITY_PLACEMENT);

  it('wants only the current room away from the door', () => {
    const step = stepRooms(layout, 1, v(1, FLOOR, 2), NONE, BOUNDS);
    expect([...step.wanted]).toEqual([1]);
    expect([...step.visible]).toEqual([1]);
  });

  it('requests the neighbour at the door and keeps it when stepping back', () => {
    const near = stepRooms(layout, 1, v(3, FLOOR, 2), NONE, BOUNDS);
    expect([...near.wanted].sort()).toEqual([1, 2]);
    expect(near.visible.has(2)).toBe(true);

    const loaded = new Set([1, 2]);
    // 1.6 m: beyond the load distance, but in memory, so it stays (and is still shown).
    const back = stepRooms(layout, 1, v(2.4, FLOOR, 2), loaded, BOUNDS);
    expect(back.wanted.has(2)).toBe(true);
    expect(back.visible.has(2)).toBe(true);
    // 3.5 m: still in memory, but hidden.
    const far = stepRooms(layout, 1, v(0.5, FLOOR, 2), loaded, BOUNDS);
    expect(far.wanted.has(2)).toBe(true);
    expect(far.visible.has(2)).toBe(false);
    // The same spot without the room in memory does not request it.
    expect(stepRooms(layout, 1, v(2.4, FLOOR, 2), NONE, BOUNDS).wanted.has(2)).toBe(false);
  });

  it('does not request a room through a door on another floor', () => {
    const step = stepRooms(layout, 1, v(3.5, FLOOR + 2.5, 2), NONE, new Map());
    expect([...step.wanted]).toEqual([1]);
  });

  it('keeps the room that was left and drops rooms two doors away', () => {
    const data = twoRooms();
    data.rooms.push(room(3, { room_frame: frame([8, 0, 0]) }));
    data.connections.push({
      connection_id: 6,
      from_room_id: 2,
      to_room_id: 3,
      from_door: { position: [4, FLOOR, 2], normal: [1, 0, 0] },
      to_door: null,
    });
    const chain = buildRoomLayout(data, IDENTITY_PLACEMENT);
    expectVector(chain.portals[1].position, v(8, FLOOR, 2));

    const entered = stepRooms(chain, 1, v(4.5, FLOOR, 2), new Set([1, 2]), BOUNDS);
    expect(entered.roomId).toBe(2);
    expect([...entered.wanted].sort()).toEqual([1, 2]);

    // At the door to room 3: room 3 loads, room 1 (a neighbour in memory) stays.
    const atNext = stepRooms(chain, 2, v(7.5, FLOOR, 2), new Set([1, 2]), BOUNDS);
    expect([...atNext.wanted].sort()).toEqual([1, 2, 3]);
    // In room 3, room 1 is two doors away and goes.
    const inThird = stepRooms(chain, 2, v(8.5, FLOOR, 2), new Set([1, 2, 3]), BOUNDS);
    expect(inThird.roomId).toBe(3);
    expect([...inThird.wanted].sort()).toEqual([2, 3]);
  });

  it('caps the rooms in memory, evicting the farthest doors beyond the release distance', () => {
    // A hall (room 1, x 0..20) with five doors along its north wall (z = 0) at x = 2, 6, ...
    const rooms = [room(1, { room_frame: frame([0, 0, 0], 0, 'start') })];
    const connections: RoomConnection[] = [];
    for (let i = 0; i < 5; i++) {
      rooms.push(room(10 + i));
      connections.push({
        connection_id: i,
        from_room_id: 1,
        to_room_id: 10 + i,
        from_door: { position: [2 + 4 * i, FLOOR, 0], normal: [0, 0, -1] },
        to_door: null,
      });
    }
    const hall = buildRoomLayout(spaceRooms(rooms, connections), IDENTITY_PLACEMENT);
    const all = new Set([1, 10, 11, 12, 13, 14]);
    const step = stepRooms(hall, 1, v(2, FLOOR, 1), all, new Map());
    expect(step.wanted.size).toBe(MAX_ROOMS_IN_MEMORY);
    expect([...step.wanted].sort()).toEqual([1, 10, 11, 12]);
    // In the middle of nowhere near any door nothing within the release distance is evicted.
    const tight = stepRooms(hall, 1, v(4, FLOOR, 1), new Set([1, 10, 11]), new Map());
    expect([...tight.wanted].sort()).toEqual([1, 10, 11]);
  });

  it('shows a room without a frame on its own', () => {
    const data = twoRooms();
    data.rooms[1].room_frame = null;
    const isolated = buildRoomLayout(data, IDENTITY_PLACEMENT);
    const step = stepRooms(isolated, 2, v(0.5, FLOOR, 2), new Set([1, 2]), BOUNDS);
    expect([...step.wanted]).toEqual([2]);
    expect([...step.visible]).toEqual([2]);
  });
});

describe('roomEntryPose', () => {
  const layout = buildRoomLayout(twoRooms(), IDENTITY_PLACEMENT);

  it('stands a step inside the entry door, looking into the room', () => {
    const pose = roomEntryPose(layout, 2, BOUNDS.get(2)!)!;
    expectVector(pose.feet, v(4 + ROOM_ENTRY_INSET_M, FLOOR, 2));
    // WalkControls looks along (-sin yaw, 0, -cos yaw); into room 2 is +X.
    expect(-Math.sin(pose.yaw!)).toBeCloseTo(1);
    expect(-Math.cos(pose.yaw!)).toBeCloseTo(0);
  });

  it('uses the door towards the room the user comes from', () => {
    const pose = roomEntryPose(layout, 1, BOUNDS.get(1)!, 2)!;
    expectVector(pose.feet, v(4 - ROOM_ENTRY_INSET_M, FLOOR, 2));
    expect(-Math.sin(pose.yaw!)).toBeCloseTo(-1);
  });

  it('falls back to the middle of the splat at eye height without a door', () => {
    const lonely = buildRoomLayout(spaceRooms([room(1)]), IDENTITY_PLACEMENT);
    const pose = roomEntryPose(lonely, 1, BOUNDS.get(1)!)!;
    expectVector(pose.feet, v(2, -0.15 - 1.6, 2));
    expect(pose.yaw).toBeNull();
    expect(roomEntryPose(lonely, 1, null)).toBeNull();
  });

  it('stays closer to the door in a room that is too small', () => {
    const small = new THREE.Box3(v(4, FLOOR, 1), v(5.5, 1.1, 3));
    const pose = roomEntryPose(layout, 2, small)!;
    expectVector(pose.feet, v(4 + ROOM_ENTRY_INSET_SMALL_M, FLOOR, 2));
  });

  it('does not trust a door that lies outside the splat', () => {
    const farAway = new THREE.Box3(v(40, FLOOR, 40), v(44, 1.1, 44));
    const pose = roomEntryPose(layout, 2, farAway)!;
    expectVector(pose.feet, v(42, FLOOR, 42));
    expect(pose.yaw).toBeNull();
  });
});
