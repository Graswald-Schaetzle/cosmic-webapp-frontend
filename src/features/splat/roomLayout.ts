import * as THREE from 'three';
import type { Door, RoomFrame, SpaceRoom, SpaceRooms } from '../../api/spaces/spacesApi';
import { hasViewableRooms, isViewableRoom } from './roomAvailability';
import { SplatPlacement, placementToMatrix } from './spaceFrame';
import { DEFAULT_WALK_PARAMS } from './walkPhysics';

/**
 * Pure logic of multi-room spaces: where each room's splat sits in the space frame, where the
 * doors between rooms are, which room the camera is in and which rooms have to be in memory.
 * The contract is cosmic-backend/docs/multi-room-spaces.md.
 *
 * CAVEAT: whether Echo-3 returns a splat in the capture coordinates of the submitted poses is
 * not verified. Room frames derived from doors are therefore estimates and rooms may overlap or
 * leave gaps. Nothing here assumes they fit: a wrong frame costs a room that loads early or
 * late, never an exception.
 */

/** A neighbouring room is requested once the camera is this close to the door to it. */
export const ROOM_LOAD_DISTANCE_M = 1.5;
/**
 * A loaded neighbour is shown up to this distance from its door, and may only be evicted
 * beyond it. Larger than the load distance, so a room is not requested and dropped in turns.
 */
export const ROOM_RELEASE_DISTANCE_M = 3;
/** A door only counts when its threshold is about on the camera's floor. */
export const DOOR_HEIGHT_TOLERANCE_M = 1.2;
/** The camera is in the next room once it is this far behind the door plane. */
export const DOOR_CROSS_HYSTERESIS_M = 0.3;
/** Further behind the door plane than this, a crossing is not attributed to the door. */
export const DOOR_CROSS_MAX_DEPTH_M = 2;
/** How far beside the door opening a crossing still counts (frames and doors are rough). */
export const DOOR_LATERAL_MARGIN_M = 0.6;
export const DEFAULT_DOOR_WIDTH_M = 0.9;
/** The current room plus this many neighbours stay in memory at most. */
export const MAX_ROOMS_IN_MEMORY = 4;
/** Outside the current room's bounds by more than this, the bounds decide the current room. */
export const ROOM_BOUNDS_MARGIN_M = 0.5;
/** Without matching bounds, the nearest door within this distance decides instead. */
export const NEAREST_DOOR_MAX_M = 4;
/**
 * How far inside a room the camera is put when jumping to its entry door: beyond the load
 * distance, so arriving does not load the room behind that door right away.
 */
export const ROOM_ENTRY_INSET_M = 1.8;
/** The same for a room too small for that. */
export const ROOM_ENTRY_INSET_SMALL_M = 0.8;
const EYE_HEIGHT_M = DEFAULT_WALK_PARAMS.eyeHeight;

export { hasViewableRooms, isViewableRoom };

const isVec3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every(v => Number.isFinite(v));

const isValidFrame = (frame: RoomFrame | null | undefined): frame is RoomFrame =>
  Boolean(frame) &&
  Number.isFinite(frame!.scale) &&
  frame!.scale > 0 &&
  isVec3(frame!.rotation_deg) &&
  isVec3(frame!.translation);

/** A viewable room whose place relative to the other rooms is known. */
export const isPlacedRoom = (room: SpaceRoom): boolean =>
  isViewableRoom(room) && isValidFrame(room.room_frame);

/**
 * A room's transform into the space frame: space placement ∘ room_frame. A room without a
 * (valid) frame gets the space placement alone, as if its capture coordinates were the rooms
 * frame; such a room is only ever shown on its own.
 */
export function composeRoomMatrix(
  spacePlacement: SplatPlacement,
  frame: RoomFrame | null | undefined
): THREE.Matrix4 {
  const matrix = placementToMatrix(spacePlacement);
  return isValidFrame(frame) ? matrix.multiply(placementToMatrix(frame)) : matrix;
}

/** A door in the space frame. */
export interface PlacedDoor {
  /** Centre of the threshold on the floor. */
  position: THREE.Vector3;
  /** Horizontal unit vector, from the connection's `from` room into its `to` room. */
  normal: THREE.Vector3;
  width: number;
}

/** Transforms a door from its room's capture coordinates; null for unusable door data. */
export function doorToSpace(
  door: Door | null | undefined,
  matrix: THREE.Matrix4
): PlacedDoor | null {
  if (!door || !isVec3(door.position) || !isVec3(door.normal)) return null;
  const normal = new THREE.Vector3(...door.normal).transformDirection(matrix);
  // The space frame is Y up; a door normal is horizontal in it.
  normal.y = 0;
  if (normal.lengthSq() < 1e-8) return null;
  normal.normalize();
  const width =
    Number.isFinite(door.width_m) && door.width_m! > 0
      ? door.width_m! * matrix.getMaxScaleOnAxis()
      : DEFAULT_DOOR_WIDTH_M;
  return { position: new THREE.Vector3(...door.position).applyMatrix4(matrix), normal, width };
}

/** One of a room's own doors, placed with that room's matrix. */
export interface RoomDoor {
  connectionId: number;
  otherRoomId: number;
  door: PlacedDoor;
  /** Horizontal unit vector pointing from the door into this room. */
  inward: THREE.Vector3;
  /** This room was entered through the door when it was captured (it is the `to` room). */
  entered: boolean;
}

export interface LayoutRoom {
  room: SpaceRoom;
  matrix: THREE.Matrix4;
  /** False for a room without a frame: it cannot be shown together with other rooms. */
  placed: boolean;
  doors: RoomDoor[];
}

/** A passage between two placed rooms, in the space frame. */
export interface Portal {
  connectionId: number;
  fromRoomId: number;
  toRoomId: number;
  position: THREE.Vector3;
  /** From `fromRoomId` into `toRoomId`. */
  normal: THREE.Vector3;
  width: number;
}

export interface RoomLayout {
  /** The viewable rooms by id, in the order of the response. */
  rooms: Map<number, LayoutRoom>;
  portals: Portal[];
}

export function buildRoomLayout(data: SpaceRooms, spacePlacement: SplatPlacement): RoomLayout {
  const rooms = new Map<number, LayoutRoom>();
  for (const room of data.rooms ?? []) {
    if (!isViewableRoom(room)) continue;
    rooms.set(room.room_id, {
      room,
      matrix: composeRoomMatrix(spacePlacement, room.room_frame),
      placed: isPlacedRoom(room),
      doors: [],
    });
  }

  const portals: Portal[] = [];
  for (const connection of data.connections ?? []) {
    const from = rooms.get(connection.from_room_id);
    const to = rooms.get(connection.to_room_id);
    const fromDoor = from ? doorToSpace(connection.from_door, from.matrix) : null;
    const toDoor = to ? doorToSpace(connection.to_door, to.matrix) : null;
    if (from && fromDoor) {
      from.doors.push({
        connectionId: connection.connection_id,
        otherRoomId: connection.to_room_id,
        door: fromDoor,
        inward: fromDoor.normal.clone().negate(),
        entered: false,
      });
    }
    if (to && toDoor) {
      to.doors.push({
        connectionId: connection.connection_id,
        otherRoomId: connection.from_room_id,
        door: toDoor,
        inward: toDoor.normal.clone(),
        entered: true,
      });
    }
    if (!from?.placed || !to?.placed || from === to) continue;
    // With a frame computed from the doors both markings coincide. Otherwise the door marked on
    // the mesh of the `from` room is the better one: `to_door` is where the user stood.
    const door = fromDoor ?? toDoor;
    if (!door) continue;
    portals.push({
      connectionId: connection.connection_id,
      fromRoomId: connection.from_room_id,
      toRoomId: connection.to_room_id,
      position: door.position,
      normal: door.normal,
      width: door.width,
    });
  }
  return { rooms, portals };
}

/**
 * The room the viewer loads first: the one set for the space, else the backend's automatic one
 * (room of the very first photo). Rooms without a finished splat are skipped; then the room the
 * frames are based on, any placed room, any viewable room.
 */
export function chooseStartRoom(data: SpaceRooms | null | undefined): number | null {
  const viewable = (data?.rooms ?? []).filter(isViewableRoom);
  if (!viewable.length) return null;
  const byId = (id: number | null | undefined) =>
    id == null ? undefined : viewable.find(room => room.room_id === id);
  const room =
    byId(data!.start_room_id) ??
    byId(data!.effective_start_room_id) ??
    viewable.find(r => r.room_frame?.source === 'start') ??
    viewable.find(isPlacedRoom) ??
    viewable[0];
  return room.room_id;
}

export interface FloorGroup {
  floorId: number | null;
  /** Null for rooms without a floor. */
  name: string | null;
  rooms: SpaceRoom[];
}

/** All rooms (also unfinished ones) grouped by floor, floors by sequence, rooms as delivered. */
export function groupRoomsByFloor(rooms: SpaceRoom[]): FloorGroup[] {
  const groups = new Map<number | null, FloorGroup & { sequence: number }>();
  for (const room of rooms) {
    const key = room.floor_id ?? null;
    let group = groups.get(key);
    if (!group) {
      group = {
        floorId: key,
        name: key === null ? null : room.floor_name,
        sequence: key === null ? Infinity : (room.floor_sequence ?? Number.MAX_VALUE),
        rooms: [],
      };
      groups.set(key, group);
    }
    group.rooms.push(room);
  }
  return [...groups.values()]
    .sort((a, b) => (a.sequence === b.sequence ? 0 : a.sequence < b.sequence ? -1 : 1))
    .map(({ floorId, name, rooms: members }) => ({ floorId, name, rooms: members }));
}

interface PortalLink {
  portal: Portal;
  otherRoomId: number;
  /** +1 when the portal's normal points out of the room, -1 when it points into it. */
  sign: 1 | -1;
}

function portalLinks(layout: RoomLayout, roomId: number): PortalLink[] {
  const links: PortalLink[] = [];
  for (const portal of layout.portals) {
    if (portal.fromRoomId === roomId) links.push({ portal, otherRoomId: portal.toRoomId, sign: 1 });
    else if (portal.toRoomId === roomId)
      links.push({ portal, otherRoomId: portal.fromRoomId, sign: -1 });
  }
  return links;
}

/** The rooms directly connected to a room by a door (placed rooms only). */
export function neighbourRoomIds(layout: RoomLayout, roomId: number): Set<number> {
  return new Set(portalLinks(layout, roomId).map(link => link.otherRoomId));
}

/** Where a point is relative to a door: behind its plane, beside its centre, away from it. */
function relativeToPortal({ portal, sign }: PortalLink, feet: THREE.Vector3) {
  const dx = feet.x - portal.position.x;
  const dz = feet.z - portal.position.z;
  return {
    /** Positive once the point is on the other room's side of the door plane. */
    depth: sign * (dx * portal.normal.x + dz * portal.normal.z),
    lateral: Math.abs(dx * portal.normal.z - dz * portal.normal.x),
    distance: Math.hypot(dx, dz),
    sameFloor: Math.abs(feet.y - portal.position.y) <= DOOR_HEIGHT_TOLERANCE_M,
  };
}

const outsideFootprint = (box: THREE.Box3, feet: THREE.Vector3, margin: number) =>
  feet.x < box.min.x - margin ||
  feet.x > box.max.x + margin ||
  feet.z < box.min.z - margin ||
  feet.z > box.max.z + margin;

const footprintArea = (box: THREE.Box3) => (box.max.x - box.min.x) * (box.max.z - box.min.z);

export interface CurrentRoom {
  roomId: number;
  /** The door the camera walked through, when the room changed at one. */
  through: Portal | null;
}

/**
 * The room the camera is in, given the room it was in. `feet` is the camera position at floor
 * level, in the space frame. `bounds` holds the space-frame bounds of the loaded rooms.
 *
 * 1. Door planes: behind the plane of one of the current room's doors (by more than the
 *    hysteresis, within the opening plus a margin) the camera is in the room behind that door.
 *    Coming back needs the same distance on this side, so standing in a doorway does not flip.
 * 2. Fallback for walking through a wall (rooms have no collision mesh yet) and for frames
 *    that are off: once the camera is clearly outside the current room's bounds, the loaded
 *    room whose bounds contain it wins (the smallest, if several), else the room behind the
 *    nearest door whose plane it has passed. Inside the current room's bounds nothing changes,
 *    so overlapping rooms do not flicker.
 */
export function resolveCurrentRoom(
  layout: RoomLayout,
  currentRoomId: number,
  feet: THREE.Vector3,
  bounds: ReadonlyMap<number, THREE.Box3>
): CurrentRoom {
  const stay: CurrentRoom = { roomId: currentRoomId, through: null };
  const current = layout.rooms.get(currentRoomId);
  // A room without a frame is shown alone; there is nothing to walk into.
  if (!current?.placed) return stay;
  const links = portalLinks(layout, currentRoomId);

  let crossed: PortalLink | null = null;
  let crossedLateral = Infinity;
  for (const link of links) {
    const rel = relativeToPortal(link, feet);
    if (
      rel.sameFloor &&
      rel.depth > DOOR_CROSS_HYSTERESIS_M &&
      rel.depth <= DOOR_CROSS_MAX_DEPTH_M &&
      rel.lateral <= link.portal.width / 2 + DOOR_LATERAL_MARGIN_M &&
      rel.lateral < crossedLateral
    ) {
      crossed = link;
      crossedLateral = rel.lateral;
    }
  }
  if (crossed) return { roomId: crossed.otherRoomId, through: crossed.portal };

  const box = bounds.get(currentRoomId);
  if (!box || !outsideFootprint(box, feet, ROOM_BOUNDS_MARGIN_M)) return stay;

  let containing: number | null = null;
  let containingArea = Infinity;
  const eyeY = feet.y + EYE_HEIGHT_M;
  for (const [roomId, other] of bounds) {
    if (roomId === currentRoomId || !layout.rooms.get(roomId)?.placed) continue;
    if (outsideFootprint(other, feet, 0) || eyeY < other.min.y - 1 || eyeY > other.max.y + 1)
      continue;
    const area = footprintArea(other);
    if (area < containingArea) {
      containing = roomId;
      containingArea = area;
    }
  }
  if (containing !== null) return { roomId: containing, through: null };

  let nearest: PortalLink | null = null;
  let nearestDistance = NEAREST_DOOR_MAX_M;
  for (const link of links) {
    const rel = relativeToPortal(link, feet);
    if (rel.sameFloor && rel.depth > 0 && rel.distance <= nearestDistance) {
      nearest = link;
      nearestDistance = rel.distance;
    }
  }
  return nearest ? { roomId: nearest.otherRoomId, through: nearest.portal } : stay;
}

export interface RoomStep extends CurrentRoom {
  /** Rooms that have to be in memory: loaded if they are not, everything else is disposed. */
  wanted: Set<number>;
  /** The rooms of `wanted` that are shown. */
  visible: Set<number>;
}

/**
 * One step of the viewer's room state for a camera position.
 *
 * Loading: the current room, plus every neighbour whose door is within ROOM_LOAD_DISTANCE_M on
 * about the same floor height. Never all rooms at once.
 *
 * Memory policy: a neighbour that is in memory (`inMemory`) stays there for as long as it is a
 * direct neighbour of the current room, so stepping back from a door does not drop it. Rooms
 * further away than one door are disposed. Above MAX_ROOMS_IN_MEMORY the neighbours with the
 * farthest doors go first, but only those beyond ROOM_RELEASE_DISTANCE_M.
 *
 * Visibility: the current room and the neighbours whose door is within ROOM_RELEASE_DISTANCE_M.
 * Hiding the others keeps the damage small if room frames are off and rooms overlap.
 */
export function stepRooms(
  layout: RoomLayout,
  currentRoomId: number,
  feet: THREE.Vector3,
  inMemory: { has(roomId: number): boolean },
  bounds: ReadonlyMap<number, THREE.Box3>
): RoomStep {
  const current = resolveCurrentRoom(layout, currentRoomId, feet, bounds);
  const wanted = new Set([current.roomId]);
  const visible = new Set([current.roomId]);
  if (!layout.rooms.get(current.roomId)?.placed) return { ...current, wanted, visible };

  // Horizontal distance to the nearest door into each neighbour (Infinity on another floor).
  const doorDistance = new Map<number, number>();
  for (const link of portalLinks(layout, current.roomId)) {
    const rel = relativeToPortal(link, feet);
    const distance = rel.sameFloor ? rel.distance : Infinity;
    doorDistance.set(
      link.otherRoomId,
      Math.min(distance, doorDistance.get(link.otherRoomId) ?? Infinity)
    );
  }
  for (const [roomId, distance] of doorDistance) {
    if (distance <= ROOM_LOAD_DISTANCE_M || inMemory.has(roomId)) wanted.add(roomId);
    if (wanted.has(roomId) && distance <= ROOM_RELEASE_DISTANCE_M) visible.add(roomId);
  }

  if (wanted.size > MAX_ROOMS_IN_MEMORY) {
    const evictable = [...doorDistance]
      .filter(([roomId, distance]) => wanted.has(roomId) && distance > ROOM_RELEASE_DISTANCE_M)
      .sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1));
    for (const [roomId] of evictable) {
      if (wanted.size <= MAX_ROOMS_IN_MEMORY) break;
      wanted.delete(roomId);
    }
  }
  return { ...current, wanted, visible };
}

export interface RoomEntryPose {
  /** Where to stand, at floor level, in the space frame. */
  feet: THREE.Vector3;
  /** Viewing direction as a WalkControls yaw; null to keep the current one. */
  yaw: number | null;
}

/**
 * Where the camera is put when the user jumps into a room: a few steps inside its entry door (the
 * door towards `fromRoomId` if given, else the door it was entered through when captured, else
 * any door), looking into the room. Without a usable door: the middle of the splat's bounds
 * with the eyes at the height of the centre. `bounds` are the room's bounds in the space frame.
 */
export function roomEntryPose(
  layout: RoomLayout,
  roomId: number,
  bounds: THREE.Box3 | null,
  fromRoomId?: number | null
): RoomEntryPose | null {
  const room = layout.rooms.get(roomId);
  if (!room) return null;
  const usable = bounds && !bounds.isEmpty() ? bounds : null;
  const centre = usable?.getCenter(new THREE.Vector3()) ?? null;

  const door =
    room.doors.find(d => fromRoomId != null && d.otherRoomId === fromRoomId) ??
    room.doors.find(d => d.entered) ??
    room.doors[0];
  if (door) {
    const yaw = Math.atan2(-door.inward.x, -door.inward.z);
    const inside = (inset: number) =>
      door.door.position.clone().addScaledVector(door.inward, inset);
    const deep = inside(ROOM_ENTRY_INSET_M);
    if (!usable || !outsideFootprint(usable, deep, 0)) return { feet: deep, yaw };
    const shallow = inside(ROOM_ENTRY_INSET_SMALL_M);
    if (!outsideFootprint(usable, shallow, ROOM_BOUNDS_MARGIN_M)) return { feet: shallow, yaw };
    // The door does not belong to this splat (frame or door off): only trust its floor height
    // if that is inside the splat.
    if (centre && door.door.position.y >= usable.min.y && door.door.position.y <= centre.y) {
      return { feet: new THREE.Vector3(centre.x, door.door.position.y, centre.z), yaw: null };
    }
  }
  if (!centre) return null;
  return { feet: new THREE.Vector3(centre.x, centre.y - EYE_HEIGHT_M, centre.z), yaw: null };
}
