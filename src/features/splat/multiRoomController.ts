import * as THREE from 'three';
import type { SpaceRoom, SpaceRooms } from '../../api/spaces/spacesApi';
import {
  RoomEntryPose,
  RoomLayout,
  buildRoomLayout,
  chooseStartRoom,
  neighbourRoomIds,
  roomEntryPose,
  stepRooms,
} from './roomLayout';
import { SplatPlacement } from './spaceFrame';
import type { Collider } from './walkPhysics';

/**
 * One room in the scene: its splat (and collision mesh, if it has one), loaded and disposed as
 * a unit. The real implementation is createRoomSplatUnit; tests use a fake.
 */
export interface RoomUnit {
  /** Resolves with the splat's bounds in the room's own (capture) coordinates. */
  ready: Promise<THREE.Box3>;
  setMatrix(matrix: THREE.Matrix4): void;
  setVisible(visible: boolean): void;
  /** The room's collision mesh at its current transform; null without one (the usual case). */
  getCollider(): Collider | null;
  /** Removes the room from the scene and frees its GPU resources. */
  dispose(): void;
}

export type CreateRoomUnit = (room: SpaceRoom, matrix: THREE.Matrix4) => RoomUnit;

export interface MultiRoomStatus {
  currentRoomId: number | null;
  /** Rooms whose splat is being fetched (a neighbour at a door, or the target of a jump). */
  loadingRoomIds: number[];
  failedRoomIds: number[];
  /** The current room has no frame and is shown on its own. */
  isolated: boolean;
  /** The current room has a collision mesh. */
  hasCollider: boolean;
}

interface Entry {
  jobId: number | null;
  unit: RoomUnit;
  state: 'loading' | 'ready' | 'error';
  matrix: THREE.Matrix4;
  localBounds: THREE.Box3 | null;
  visible: boolean;
}

/**
 * Keeps the room splats of a multi-room space in the scene: loads the start room, loads a
 * neighbour when the camera comes to the door to it, tracks which room the camera is in and
 * disposes rooms that are no longer needed. The decisions are in roomLayout.ts (stepRooms);
 * this class only applies them to the units.
 *
 * Every room is an independent unit keyed by its capture (`job_id`): when a room is captured
 * again, only that room is replaced.
 */
export class MultiRoomController {
  private layout: RoomLayout = { rooms: new Map(), portals: [] };
  private data: SpaceRooms | null = null;
  private readonly entries = new Map<number, Entry>();
  /** Space-frame bounds of the rooms whose splat has loaded. */
  private readonly bounds = new Map<number, THREE.Box3>();
  private current: number | null = null;
  /** The target of a jump: kept in memory, hidden, until it has loaded. */
  private pending: number | null = null;
  private readonly lastFeet = new THREE.Vector3();
  private hasFeet = false;
  private lastStatus = '';
  private disposed = false;

  constructor(
    private readonly createUnit: CreateRoomUnit,
    private readonly onStatus?: (status: MultiRoomStatus) => void
  ) {}

  get currentRoomId(): number | null {
    return this.current;
  }

  /** The current room has no frame: it is shown alone and the space's tags do not apply to it. */
  get isolated(): boolean {
    const room = this.current === null ? undefined : this.layout.rooms.get(this.current);
    return Boolean(room && !room.placed);
  }

  /** The collision mesh of the current room, if it has one. */
  get collider(): Collider | null {
    if (this.current === null) return null;
    return this.entries.get(this.current)?.unit.getCollider() ?? null;
  }

  /**
   * Takes over new room data or a new placement of the space. Rooms that are gone or whose
   * capture was replaced are disposed (and loaded again when needed); the others only move.
   */
  setData(data: SpaceRooms, placement: SplatPlacement) {
    if (this.disposed) return;
    this.data = data;
    this.layout = buildRoomLayout(data, placement);
    for (const [roomId, entry] of [...this.entries]) {
      const room = this.layout.rooms.get(roomId);
      if (!room || room.room.job_id !== entry.jobId) {
        this.remove(roomId);
        continue;
      }
      if (!room.matrix.equals(entry.matrix)) {
        entry.matrix = room.matrix;
        entry.unit.setMatrix(room.matrix);
        if (entry.localBounds) {
          this.bounds.set(roomId, entry.localBounds.clone().applyMatrix4(room.matrix));
        }
      }
    }
    if (this.pending !== null && !this.layout.rooms.has(this.pending)) this.pending = null;
    if (this.current !== null) this.sync();
  }

  /**
   * Jumps into a room: loads it if needed and makes it the current room once its splat is
   * there (until then the previous room stays). Resolves with where to put the camera; rejects
   * when the room cannot be loaded or another jump took over.
   */
  async enter(roomId: number, fromRoomId: number | null = this.current): Promise<RoomEntryPose> {
    if (!this.layout.rooms.has(roomId)) throw new Error('Room is not available');
    // A failed room gets another try when the user asks for it again.
    if (this.entries.get(roomId)?.state === 'error') this.remove(roomId);
    this.pending = roomId;
    const entry = this.ensure(roomId);
    this.emit();
    try {
      await entry.unit.ready;
    } catch (error) {
      if (this.pending === roomId) this.pending = null;
      this.emit();
      throw error;
    }
    if (this.disposed || this.pending !== roomId || this.entries.get(roomId) !== entry) {
      throw new Error('Room change was superseded');
    }
    this.pending = null;
    this.current = roomId;
    const pose = roomEntryPose(this.layout, roomId, this.bounds.get(roomId) ?? null, fromRoomId);
    if (!pose) throw new Error('Room has no usable bounds');
    this.lastFeet.copy(pose.feet);
    this.hasFeet = true;
    this.sync();
    return pose;
  }

  /**
   * Call every frame while walking with the camera position at floor level (space frame).
   * Returns the room that was just entered on foot and the floor height at its door, if known.
   */
  update(feet: THREE.Vector3): { enteredRoomId: number; floorY: number | null } | null {
    if (this.disposed || this.current === null) return null;
    this.lastFeet.copy(feet);
    this.hasFeet = true;
    const before = this.current;
    const through = this.sync();
    if (this.current === before || this.current === null) return null;
    return { enteredRoomId: this.current, floorY: through?.position.y ?? null };
  }

  dispose() {
    this.disposed = true;
    for (const roomId of [...this.entries.keys()]) this.remove(roomId);
    this.current = null;
    this.pending = null;
  }

  /** Applies one step of the room state; returns the door that was walked through, if any. */
  private sync() {
    if (this.current === null) return null;
    if (!this.layout.rooms.has(this.current)) {
      // The current room disappeared from the data (deleted, or its capture is not shown any
      // more): fall back to the start room rather than showing nothing.
      const fallback = chooseStartRoom(this.data);
      if (fallback === null) {
        this.current = null;
        this.emit();
        return null;
      }
      this.current = fallback;
      this.hasFeet = false;
    }

    let wanted: Set<number>;
    let visible: Set<number>;
    let through = null;
    if (this.hasFeet) {
      const step = stepRooms(this.layout, this.current, this.lastFeet, this.entries, this.bounds);
      this.current = step.roomId;
      ({ wanted, visible, through } = step);
    } else {
      // No camera position yet: the current room and whatever neighbours are in memory.
      wanted = new Set([this.current]);
      visible = new Set([this.current]);
      for (const roomId of neighbourRoomIds(this.layout, this.current)) {
        if (this.entries.has(roomId)) wanted.add(roomId);
      }
    }
    if (this.pending !== null) wanted.add(this.pending);

    for (const roomId of [...this.entries.keys()]) {
      if (!wanted.has(roomId)) this.remove(roomId);
    }
    for (const roomId of wanted) {
      const entry = this.ensure(roomId);
      const show = visible.has(roomId);
      if (entry.visible !== show) {
        entry.visible = show;
        entry.unit.setVisible(show);
      }
    }
    this.emit();
    return through;
  }

  private ensure(roomId: number): Entry {
    const existing = this.entries.get(roomId);
    if (existing) return existing;
    const room = this.layout.rooms.get(roomId)!;
    const unit = this.createUnit(room.room, room.matrix);
    const entry: Entry = {
      jobId: room.room.job_id,
      unit,
      state: 'loading',
      matrix: room.matrix,
      localBounds: null,
      visible: false,
    };
    // Hidden until a step shows it; the target of a jump stays hidden until it is current.
    unit.setVisible(false);
    this.entries.set(roomId, entry);
    unit.ready.then(
      box => {
        if (this.entries.get(roomId) !== entry) return;
        entry.state = 'ready';
        entry.localBounds = box.clone();
        if (!box.isEmpty()) this.bounds.set(roomId, box.clone().applyMatrix4(entry.matrix));
        this.emit();
      },
      error => {
        if (this.entries.get(roomId) !== entry) return;
        console.warn(`Room ${roomId} could not be loaded:`, error);
        entry.state = 'error';
        this.emit();
      }
    );
    return entry;
  }

  private remove(roomId: number) {
    const entry = this.entries.get(roomId);
    if (!entry) return;
    this.entries.delete(roomId);
    this.bounds.delete(roomId);
    entry.unit.dispose();
  }

  private emit() {
    if (!this.onStatus || this.disposed) return;
    const idsIn = (state: Entry['state']) =>
      [...this.entries].filter(([, entry]) => entry.state === state).map(([roomId]) => roomId);
    const status: MultiRoomStatus = {
      currentRoomId: this.current,
      loadingRoomIds: idsIn('loading'),
      failedRoomIds: idsIn('error'),
      isolated: this.isolated,
      hasCollider: Boolean(this.collider),
    };
    const key = JSON.stringify(status);
    if (key === this.lastStatus) return;
    this.lastStatus = key;
    this.onStatus(status);
  }
}
