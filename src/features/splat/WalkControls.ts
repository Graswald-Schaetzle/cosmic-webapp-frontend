import * as THREE from 'three';
import {
  Collider,
  DEFAULT_WALK_PARAMS,
  WalkParams,
  WalkerState,
  createWalkerState,
  floorHeightBelow,
  stepWalker,
} from './walkPhysics';

const LOOK_SENSITIVITY = 0.0032;
/** Radians per mouse count while the pointer is locked (mouse look as in a first-person game). */
const MOUSE_LOOK_SENSITIVITY = 0.0022;
/** Some browsers report one huge movement when the lock starts or ends; those are dropped. */
const MAX_MOUSE_STEP = 250;
const MAX_PITCH = Math.PI / 2 - 0.05;
const TAP_MAX_MOVE_PX = 8;
const TAP_MAX_MS = 350;
const MIN_FOV = 40;
const MAX_FOV = 100;
const TARGET_REACHED = 0.15;

export interface WalkControlsOptions {
  /**
   * Called for a short press without dragging, with client coordinates. While the pointer is
   * locked it is the centre of the view, where the crosshair is.
   */
  onTap?: (clientX: number, clientY: number, pointerType: string) => void;
  /** Called when mouse look starts (true) or ends (false), also when the user presses Esc. */
  onLockChange?: (locked: boolean) => void;
  /** Called when the browser refuses to lock the pointer. */
  onLockError?: () => void;
  params?: WalkParams;
}

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
};

/**
 * First-person controls for a splat scene: WASD / arrow keys (Shift to run), drag to look,
 * on-screen joystick input for touch, pinch to zoom, and "walk to point" targets. Movement is
 * resolved against an optional collision mesh; without one the camera flies freely.
 *
 * With the pointer locked (see requestLock) the mouse turns the view directly, like in a
 * first-person game, and a click acts on the centre of the view.
 */
export class WalkControls {
  enabled = true;
  collider: Collider | null = null;
  readonly walker: WalkerState;
  yaw = 0;
  pitch = 0;
  /** Whether requestLock may lock the pointer; off on touch devices. */
  mouseLook = false;

  /** Joystick vector in [-1, 1]: x = strafe right, y = forward. */
  moveInput = new THREE.Vector2();

  private readonly params: WalkParams;
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<
    number,
    { x: number; y: number; startX: number; startY: number; startT: number; moved: number }
  >();
  private pinchDistance = 0;
  private target: THREE.Vector3 | null = null;
  private readonly smoothedMove = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private lastSafe = new THREE.Vector3();
  private lastLookActivity = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly element: HTMLElement,
    private readonly options: WalkControlsOptions = {}
  ) {
    this.params = options.params ?? DEFAULT_WALK_PARAMS;
    this.walker = createWalkerState(camera.position);
    this.syncFromCamera();
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  /** True while the pointer is locked to the view and the mouse turns the camera. */
  get locked(): boolean {
    return document.pointerLockElement === this.element;
  }

  /** Locks the pointer; must run inside a user gesture (click, key press). */
  requestLock() {
    if (!this.mouseLook || this.locked || !this.element.requestPointerLock) return;
    try {
      // Older browsers return nothing, newer ones a promise that rejects when refused.
      const result = this.element.requestPointerLock() as Promise<void> | undefined;
      result?.catch?.(() => this.options.onLockError?.());
    } catch {
      this.options.onLockError?.();
    }
  }

  exitLock() {
    if (this.locked) document.exitPointerLock();
  }

  dispose() {
    this.exitLock();
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
    this.element.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  /** True while the user is moving or looking, used to pause "hold still to place a tag". */
  get isActive(): boolean {
    return (
      this.keys.size > 0 ||
      this.moveInput.lengthSq() > 0 ||
      this.target !== null ||
      performance.now() - this.lastLookActivity < 250
    );
  }

  /** Takes over position and viewing direction from the camera (e.g. when leaving orbit mode). */
  syncFromCamera() {
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = THREE.MathUtils.clamp(euler.x, -MAX_PITCH, MAX_PITCH);
    this.walker.position.set(
      this.camera.position.x,
      this.camera.position.y - this.params.eyeHeight,
      this.camera.position.z
    );
    this.walker.verticalVelocity = 0;
    this.walker.onGround = false;
    this.target = null;
    this.lastSafe.copy(this.walker.position);
  }

  /** Puts the walker on the floor below the given point, standing there. */
  placeAt(point: THREE.Vector3) {
    let y = point.y;
    if (this.collider) {
      const floor = floorHeightBelow(this.collider, new THREE.Vector3(point.x, point.y, point.z));
      if (floor !== null) y = floor;
    }
    this.walker.position.set(point.x, y, point.z);
    this.walker.verticalVelocity = 0;
    this.lastSafe.copy(this.walker.position);
    this.applyToCamera();
  }

  lookAt(point: THREE.Vector3) {
    const dx = point.x - this.walker.position.x;
    const dz = point.z - this.walker.position.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.applyToCamera();
  }

  walkTo(point: THREE.Vector3) {
    this.target = point.clone();
  }

  update(dt: number) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.1);

    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let strafe = this.moveInput.x;
    let ahead = this.moveInput.y;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ahead += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ahead -= 1;

    const manual = strafe !== 0 || ahead !== 0;
    if (manual) this.target = null;

    this.desired.set(0, 0, 0);
    if (manual) {
      const length = Math.hypot(strafe, ahead);
      const scale = Math.min(1, length) / length;
      this.desired
        .addScaledVector(this.right, strafe * scale)
        .addScaledVector(this.forward, ahead * scale);
    } else if (this.target) {
      const dx = this.target.x - this.walker.position.x;
      const dz = this.target.z - this.walker.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < TARGET_REACHED) this.target = null;
      else this.desired.set(dx / distance, 0, dz / distance);
    }

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = this.params.walkSpeed * (running ? this.params.runFactor : 1);
    this.desired.multiplyScalar(speed);

    // Ease in and out so starting and stopping feels soft rather than abrupt.
    const ease = 1 - Math.exp(-dt * 12);
    this.smoothedMove.lerp(this.desired, ease);

    const before = this.walker.position.clone();
    if (this.collider) {
      stepWalker(this.walker, this.smoothedMove, dt, this.collider, this.params);
      // The mesh can have holes; if we ever end up far below it, go back to the last good spot.
      if (this.walker.position.y < this.collider.bounds.min.y - 1) {
        this.walker.position.copy(this.lastSafe);
        this.walker.verticalVelocity = 0;
      } else if (this.walker.onGround) {
        this.lastSafe.copy(this.walker.position);
      }
      // Stuck against a wall while auto-walking: give up on the target.
      if (this.target && before.distanceToSquared(this.walker.position) < 1e-8 * dt)
        this.target = null;
    } else {
      // No collision mesh: move freely in the horizontal plane.
      const fly = new THREE.Vector3(this.smoothedMove.x, 0, this.smoothedMove.z);
      this.walker.position.addScaledVector(fly, dt);
    }
    this.applyToCamera();
  }

  private applyToCamera() {
    this.camera.position.set(
      this.walker.position.x,
      this.walker.position.y + this.params.eyeHeight,
      this.walker.position.z
    );
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (
      !this.enabled ||
      isTypingTarget(event.target) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(event.code)) {
      this.keys.add(event.code);
      if (event.code.startsWith('Arrow')) event.preventDefault();
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.moveInput.set(0, 0);
  };

  private onLockChange = () => {
    // Pointer states from before the switch would turn into bogus drags or taps.
    this.pointers.clear();
    this.pinchDistance = 0;
    this.options.onLockChange?.(this.locked);
  };

  private onLockError = () => this.options.onLockError?.();

  private onMouseMove = (event: MouseEvent) => {
    if (!this.enabled || !this.locked) return;
    if (Math.abs(event.movementX) > MAX_MOUSE_STEP || Math.abs(event.movementY) > MAX_MOUSE_STEP)
      return;
    this.yaw -= event.movementX * MOUSE_LOOK_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - event.movementY * MOUSE_LOOK_SENSITIVITY,
      -MAX_PITCH,
      MAX_PITCH
    );
    this.lastLookActivity = performance.now();
  };

  private onPointerDown = (event: PointerEvent) => {
    // Only the primary button looks and taps; the secondary one is used for the menus.
    if (!this.enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!this.locked) this.element.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startT: performance.now(),
      moved: 0,
    });
    if (this.pointers.size === 2) this.pinchDistance = this.currentPinchDistance();
  };

  private onPointerMove = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    // While locked the mouse turns the view (onMouseMove) and the pointer position stands still.
    if (!this.enabled || !pointer || this.locked) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.moved = Math.max(
      pointer.moved,
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY)
    );

    if (this.pointers.size >= 2) {
      const distance = this.currentPinchDistance();
      if (this.pinchDistance > 0 && distance > 0) {
        this.setFov(this.camera.fov * (this.pinchDistance / distance));
      }
      this.pinchDistance = distance;
      return;
    }
    if (pointer.moved > TAP_MAX_MOVE_PX) {
      this.yaw -= dx * LOOK_SENSITIVITY;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
      this.lastLookActivity = performance.now();
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    this.pinchDistance = 0;
    if (!this.enabled || !pointer || event.type === 'pointercancel') return;
    const isTap =
      pointer.moved <= TAP_MAX_MOVE_PX && performance.now() - pointer.startT <= TAP_MAX_MS;
    if (!isTap || this.pointers.size !== 0) return;
    if (this.locked) {
      const rect = this.element.getBoundingClientRect();
      this.options.onTap?.(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        event.pointerType
      );
    } else {
      this.options.onTap?.(event.clientX, event.clientY, event.pointerType);
    }
  };

  private onWheel = (event: WheelEvent) => {
    if (!this.enabled) return;
    event.preventDefault();
    this.setFov(this.camera.fov + event.deltaY * 0.03);
  };

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private setFov(fov: number) {
    this.camera.fov = THREE.MathUtils.clamp(fov, MIN_FOV, MAX_FOV);
    this.camera.updateProjectionMatrix();
  }
}
